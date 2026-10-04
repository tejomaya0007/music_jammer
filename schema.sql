-- =====================================================================
-- Jam Room: Supabase schema
-- Run this whole file once in: Supabase Dashboard -> SQL Editor -> New query
-- Before that: Authentication -> Sign In / Providers -> enable "Allow anonymous sign-ins"
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table public.rooms (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  host_id          uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'active',          -- active | idle | closed
  current_song_id  uuid,                                    -- pointer into songs (null = nothing selected)
  is_playing       boolean not null default false,
  anchor_pos_ms    integer not null default 0,              -- playback position at anchor_time
  anchor_time      timestamptz not null default now(),
  state_version    integer not null default 0,              -- bumps on every playback change
  max_members      integer not null default 10,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create table public.room_members (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  name      text not null,
  joined_at timestamptz not null default now(),
  is_kicked boolean not null default false,
  primary key (room_id, user_id)
);

-- heartbeat lives in its own table so it never triggers realtime events
create table public.member_seen (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table public.songs (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  video_id   text not null,
  title      text not null,
  thumbnail  text,
  added_by   uuid references auth.users(id) on delete set null,
  position   double precision not null,
  created_at timestamptz not null default now()
);
create index songs_room_pos_idx on public.songs (room_id, position);

create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete set null,
  name       text,
  kind       text not null default 'user',                  -- user | system
  text       text not null check (char_length(text) <= 500),
  created_at timestamptz not null default now()
);
create index messages_room_time_idx on public.messages (room_id, created_at);

-- ---------- helpers ----------
create or replace function public.is_member(p_room uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.room_members
    where room_id = p_room and user_id = auth.uid() and not is_kicked
  );
$$;

create or replace function public._assert_member(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from room_members
    where room_id = p_room and user_id = auth.uid() and not is_kicked
  ) then
    raise exception 'Not a member of this room';
  end if;
end $$;

create or replace function public._assert_host(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where id = p_room and host_id = auth.uid()) then
    raise exception 'Only the host can do that';
  end if;
end $$;

create or replace function public.gen_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   -- no I, L, O, 0, 1
  res text := '';
  i integer;
begin
  for i in 1..6 loop
    res := res || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return res;
end $$;

create or replace function public._set_current(p_room uuid, p_song uuid, p_playing boolean)
returns void language sql security definer set search_path = public as $$
  update rooms
     set current_song_id = p_song,
         is_playing = p_playing,
         anchor_pos_ms = 0,
         anchor_time = now(),
         state_version = state_version + 1,
         last_activity_at = now()
   where id = p_room;
$$;

-- ---------- row level security: members can read, nobody writes directly ----------
alter table public.rooms        enable row level security;
alter table public.room_members enable row level security;
alter table public.member_seen  enable row level security;
alter table public.songs        enable row level security;
alter table public.messages     enable row level security;

create policy rooms_select    on public.rooms        for select using (public.is_member(id));
create policy members_select  on public.room_members for select using (public.is_member(room_id));
create policy songs_select    on public.songs        for select using (public.is_member(room_id));
create policy messages_select on public.messages     for select using (public.is_member(room_id));

revoke insert, update, delete on public.rooms, public.room_members, public.member_seen,
                                 public.songs, public.messages from anon, authenticated;
-- explicit read grants (do not rely on Supabase default privileges); RLS still filters rows
grant usage on schema public to anon, authenticated;
grant select on public.rooms, public.room_members, public.songs, public.messages to authenticated;

-- ---------- realtime ----------
alter publication supabase_realtime add table public.rooms, public.songs, public.room_members, public.messages;

-- ---------- room lifecycle ----------
create or replace function public.create_room(p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_code text; v_id uuid; tries integer := 0; nm text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  nm := left(trim(coalesce(p_name, '')), 30);
  if nm = '' then raise exception 'Please enter a name'; end if;
  loop
    v_code := gen_code();
    begin
      insert into rooms (code, host_id) values (v_code, auth.uid()) returning id into v_id;
      exit;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 10 then raise; end if;
    end;
  end loop;
  insert into room_members (room_id, user_id, name) values (v_id, auth.uid(), nm);
  insert into member_seen (room_id, user_id) values (v_id, auth.uid());
  insert into messages (room_id, kind, text) values (v_id, 'system', nm || ' created the room');
  return json_build_object('id', v_id, 'code', v_code);
end $$;

create or replace function public.join_room(p_code text, p_name text)
returns json language plpgsql security definer set search_path = public as $$
declare
  r rooms; m room_members; cnt integer; nm text; pos integer;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  nm := left(trim(coalesce(p_name, '')), 30);
  if nm = '' then raise exception 'Please enter a name'; end if;

  select * into r from rooms where code = upper(trim(p_code)) for update;
  if not found or r.status = 'closed' then raise exception 'Room not found or closed'; end if;

  select * into m from room_members where room_id = r.id and user_id = auth.uid();
  if found then
    if m.is_kicked then raise exception 'You were removed from this room'; end if;
    update room_members set name = nm where room_id = r.id and user_id = auth.uid();
  else
    select count(*) into cnt from room_members where room_id = r.id and not is_kicked;
    if cnt >= r.max_members then raise exception 'Room is full'; end if;
    insert into room_members (room_id, user_id, name) values (r.id, auth.uid(), nm);
    insert into messages (room_id, kind, text) values (r.id, 'system', nm || ' joined');
  end if;

  -- if nobody (including me) has been around recently, freeze playback where it was
  if r.is_playing and not exists (
    select 1 from member_seen where room_id = r.id and seen_at > now() - interval '45 seconds'
  ) then
    pos := r.anchor_pos_ms + (extract(epoch from (now() - r.anchor_time)) * 1000)::int;
    update rooms set is_playing = false, anchor_pos_ms = pos, anchor_time = now(),
                     state_version = state_version + 1 where id = r.id;
  end if;

  -- room was idle (host left, last person out): the first one back becomes host
  if not exists (select 1 from room_members where room_id = r.id and user_id = r.host_id and not is_kicked) then
    update rooms set host_id = auth.uid() where id = r.id;
    insert into messages (room_id, kind, text) values (r.id, 'system', nm || ' is now the host');
  end if;

  update rooms set status = 'active', last_activity_at = now() where id = r.id;
  insert into member_seen (room_id, user_id, seen_at) values (r.id, auth.uid(), now())
    on conflict (room_id, user_id) do update set seen_at = now();

  return json_build_object('id', r.id, 'code', r.code);
end $$;

create or replace function public.leave_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r rooms; nm text; nh uuid; cnt integer; pos integer;
begin
  select * into r from rooms where id = p_room for update;
  if not found then return; end if;
  select name into nm from room_members where room_id = p_room and user_id = auth.uid();
  if nm is null then return; end if;

  delete from room_members where room_id = p_room and user_id = auth.uid();
  delete from member_seen  where room_id = p_room and user_id = auth.uid();
  insert into messages (room_id, kind, text) values (p_room, 'system', nm || ' left');

  select count(*) into cnt from room_members where room_id = p_room and not is_kicked;
  if cnt = 0 then
    -- last person out: pause and go idle (queue and chat are kept)
    pos := r.anchor_pos_ms + case when r.is_playing
             then (extract(epoch from (now() - r.anchor_time)) * 1000)::int else 0 end;
    update rooms set status = 'idle', is_playing = false, anchor_pos_ms = pos, anchor_time = now(),
                     state_version = state_version + 1, last_activity_at = now() where id = p_room;
  elsif r.host_id = auth.uid() then
    -- host left: longest-present member who is online becomes host; the room keeps running
    select m.user_id into nh
      from room_members m
      left join member_seen s on s.room_id = m.room_id and s.user_id = m.user_id
     where m.room_id = p_room and not m.is_kicked
     order by (coalesce(s.seen_at, '-infinity'::timestamptz) > now() - interval '40 seconds') desc,
              m.joined_at asc
     limit 1;
    update rooms set host_id = nh, last_activity_at = now() where id = p_room;
    insert into messages (room_id, kind, text)
      values (p_room, 'system',
              (select name from room_members where room_id = p_room and user_id = nh) || ' is now the host');
  end if;
end $$;

-- called every ~15 s by every client; also hands over host if the host vanished
create or replace function public.heartbeat(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r rooms; nh uuid;
begin
  perform _assert_member(p_room);
  insert into member_seen (room_id, user_id, seen_at) values (p_room, auth.uid(), now())
    on conflict (room_id, user_id) do update set seen_at = now();

  select * into r from rooms where id = p_room;
  if r.host_id <> auth.uid() and not exists (
    select 1 from member_seen
     where room_id = p_room and user_id = r.host_id and seen_at > now() - interval '40 seconds'
  ) then
    select m.user_id into nh
      from room_members m
      join member_seen s on s.room_id = m.room_id and s.user_id = m.user_id
     where m.room_id = p_room and not m.is_kicked and s.seen_at > now() - interval '40 seconds'
     order by m.joined_at asc
     limit 1;
    if nh = auth.uid() then
      update rooms set host_id = nh, last_activity_at = now() where id = p_room;
      insert into messages (room_id, kind, text)
        values (p_room, 'system',
                (select name from room_members where room_id = p_room and user_id = nh) || ' is now the host');
    end if;
  end if;
end $$;

create or replace function public.kick_member(p_room uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  perform _assert_host(p_room);
  if p_user = auth.uid() then raise exception 'You cannot remove yourself'; end if;
  select name into nm from room_members where room_id = p_room and user_id = p_user;
  update room_members set is_kicked = true where room_id = p_room and user_id = p_user;
  delete from member_seen where room_id = p_room and user_id = p_user;
  if nm is not null then
    insert into messages (room_id, kind, text) values (p_room, 'system', nm || ' was removed by the host');
  end if;
end $$;

create or replace function public.close_room(p_room uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _assert_host(p_room);
  update rooms set status = 'closed', is_playing = false, state_version = state_version + 1,
                   last_activity_at = now() where id = p_room;
end $$;

-- ---------- queue ----------
create or replace function public.add_song(p_room uuid, p_video text, p_title text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r rooms; pos double precision; sid uuid;
begin
  perform _assert_member(p_room);
  if p_video !~ '^[A-Za-z0-9_-]{11}$' then raise exception 'Invalid video id'; end if;
  if (select count(*) from songs where room_id = p_room) >= 200 then
    raise exception 'Queue is full (200 songs)';
  end if;
  select coalesce(max(position), 0) + 1 into pos from songs where room_id = p_room;
  insert into songs (room_id, video_id, title, thumbnail, added_by, position)
    values (p_room, p_video, left(coalesce(nullif(trim(p_title), ''), 'YouTube video'), 200),
            'https://i.ytimg.com/vi/' || p_video || '/mqdefault.jpg', auth.uid(), pos)
    returning id into sid;
  select * into r from rooms where id = p_room for update;
  if r.current_song_id is null then
    perform _set_current(p_room, sid, true);
  else
    update rooms set last_activity_at = now() where id = p_room;
  end if;
  return sid;
end $$;

create or replace function public.remove_song(p_song uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  s songs; r rooms; nid uuid;
begin
  select * into s from songs where id = p_song;
  if not found then return; end if;
  perform _assert_member(s.room_id);
  select * into r from rooms where id = s.room_id for update;
  if r.current_song_id = s.id then
    select id into nid from songs where room_id = s.room_id and position > s.position
      order by position limit 1;
    if nid is null then
      update rooms set current_song_id = null, is_playing = false, anchor_pos_ms = 0, anchor_time = now(),
                       state_version = state_version + 1, last_activity_at = now() where id = r.id;
    else
      perform _set_current(r.id, nid, r.is_playing);
    end if;
  end if;
  delete from songs where id = p_song;
end $$;

create or replace function public.reorder_song(p_song uuid, p_pos double precision)
returns void language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  select room_id into rid from songs where id = p_song;
  if rid is null then return; end if;
  perform _assert_member(rid);
  update songs set position = p_pos where id = p_song;
  update rooms set last_activity_at = now() where id = rid;
end $$;

-- ---------- playback ----------
create or replace function public.playback(p_room uuid, p_action text, p_pos integer default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  r rooms; pos integer; first_id uuid;
begin
  perform _assert_member(p_room);
  select * into r from rooms where id = p_room for update;
  pos := r.anchor_pos_ms + case when r.is_playing
           then (extract(epoch from (now() - r.anchor_time)) * 1000)::int else 0 end;

  if p_action = 'pause' then
    update rooms set is_playing = false, anchor_pos_ms = pos, anchor_time = now(),
                     state_version = state_version + 1, last_activity_at = now() where id = p_room;
  elsif p_action = 'play' then
    if r.current_song_id is null then
      select id into first_id from songs where room_id = p_room order by position limit 1;
      if first_id is null then raise exception 'The queue is empty'; end if;
      perform _set_current(p_room, first_id, true);
    else
      update rooms set is_playing = true, anchor_pos_ms = pos, anchor_time = now(),
                       state_version = state_version + 1, last_activity_at = now() where id = p_room;
    end if;
  elsif p_action = 'seek' then
    update rooms set anchor_pos_ms = greatest(p_pos, 0), anchor_time = now(),
                     state_version = state_version + 1, last_activity_at = now() where id = p_room;
  else
    raise exception 'Unknown action';
  end if;
end $$;

create or replace function public.play_song(p_room uuid, p_song uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform _assert_member(p_room);
  if not exists (select 1 from songs where id = p_song and room_id = p_room) then return; end if;
  perform _set_current(p_room, p_song, true);
end $$;

create or replace function public.next_song(p_room uuid, p_version integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r rooms; cur double precision; nid uuid;
begin
  perform _assert_member(p_room);
  select * into r from rooms where id = p_room for update;
  if p_version is not null and r.state_version <> p_version then return; end if;  -- stale click
  select coalesce((select position from songs where id = r.current_song_id), -1e18) into cur;
  select id into nid from songs where room_id = p_room and position > cur order by position limit 1;
  if nid is null then
    update rooms set current_song_id = null, is_playing = false, anchor_pos_ms = 0, anchor_time = now(),
                     state_version = state_version + 1, last_activity_at = now() where id = p_room;
  else
    perform _set_current(p_room, nid, true);
  end if;
end $$;

create or replace function public.prev_song(p_room uuid, p_version integer default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r rooms; cur double precision; pid uuid; pos integer;
begin
  perform _assert_member(p_room);
  select * into r from rooms where id = p_room for update;
  if p_version is not null and r.state_version <> p_version then return; end if;

  if r.current_song_id is null then
    select id into pid from songs where room_id = p_room order by position desc limit 1;
    if pid is not null then perform _set_current(p_room, pid, true); end if;
    return;
  end if;

  pos := r.anchor_pos_ms + case when r.is_playing
           then (extract(epoch from (now() - r.anchor_time)) * 1000)::int else 0 end;
  if pos > 5000 then
    perform _set_current(p_room, r.current_song_id, true);          -- restart this song
    return;
  end if;

  select position into cur from songs where id = r.current_song_id;
  select id into pid from songs where room_id = p_room and position < cur order by position desc limit 1;
  perform _set_current(p_room, coalesce(pid, r.current_song_id), true);
end $$;

-- reported by clients when a video ends (or errors). Only acts if that song is still current.
create or replace function public.song_ended(p_room uuid, p_song uuid, p_error boolean default false)
returns void language plpgsql security definer set search_path = public as $$
declare
  r rooms; t text;
begin
  perform _assert_member(p_room);
  select * into r from rooms where id = p_room for update;
  if r.current_song_id is distinct from p_song then return; end if;
  if p_error then
    select title into t from songs where id = p_song;
    insert into messages (room_id, kind, text)
      values (p_room, 'system', 'Couldn''t play "' || left(coalesce(t, 'song'), 80) || '", skipped');
  end if;
  perform next_song(p_room, null);
end $$;

-- ---------- chat & time ----------
create or replace function public.send_message(p_room uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare
  txt text; nm text;
begin
  perform _assert_member(p_room);
  txt := left(trim(coalesce(p_text, '')), 500);
  if txt = '' then return; end if;
  if (select count(*) from messages
       where room_id = p_room and user_id = auth.uid() and created_at > now() - interval '10 seconds') >= 8 then
    raise exception 'Slow down a little';
  end if;
  select name into nm from room_members where room_id = p_room and user_id = auth.uid();
  insert into messages (room_id, user_id, name, kind, text) values (p_room, auth.uid(), nm, 'user', txt);
  update rooms set last_activity_at = now() where id = p_room;
end $$;

create or replace function public.get_server_time()
returns bigint language sql as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

-- ---------- permissions: only signed-in (anonymous counts) users can call functions ----------
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
-- internal helpers must not be callable directly (they skip the membership check)
revoke execute on function public._set_current(uuid, uuid, boolean),
                          public._assert_member(uuid),
                          public._assert_host(uuid),
                          public.gen_code()
  from authenticated;

-- ---------- optional: auto-delete abandoned rooms ----------
-- Enable the pg_cron extension (Database -> Extensions), then run:
-- select cron.schedule('jam-cleanup', '0 * * * *', $$
--   delete from public.rooms r
--    where not exists (select 1 from public.member_seen s
--                       where s.room_id = r.id and s.seen_at > now() - interval '24 hours')
--      and r.last_activity_at < now() - interval '24 hours'
-- $$);
