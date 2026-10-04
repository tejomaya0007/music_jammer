# Jam Room: Architecture

Companion to `context.md` (what the app does). This file is how it is built. **`schema.sql` is the source of truth** for tables, security rules, and server functions; this file explains them and describes the client.

## 1. Key decisions

- **Installable website (PWA).** One codebase, opened in Brave or Chrome, added to the home screen, opens full screen. Updating means redeploying; friends get the new version on next open.
- **No backend server.** The browser talks directly to Supabase. All server-side logic lives in Postgres functions (`schema.sql`) that the browser calls as RPCs. No Railway, Render, or Socket.IO.
- **The Supabase public key is safe in the browser.** Security comes from Row Level Security (members can only read their own room) plus the functions re-checking membership on every action. Clients cannot write tables directly.
- **Anonymous accounts.** Supabase anonymous sign-in gives each phone a user ID with no signup. Friends only type a display name.

## 2. Stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React + TypeScript |
| PWA | `vite-plugin-pwa` (manifest, service worker, icons) |
| Backend | Supabase: Postgres, Auth (anonymous), Realtime (changes + Presence) |
| Player | YouTube IFrame Player API |
| Song titles | YouTube oEmbed (`youtube.com/oembed`), no API key |
| Drag to reorder | `@dnd-kit/sortable` (or SortableJS) |
| Client state | Zustand (or React context) |
| Hosting | Vercel, Netlify, or Cloudflare Pages (static, free) |

## 3. Diagram

```
 Phone A            Phone B            Phone C
┌─────────┐       ┌─────────┐        ┌─────────┐
│ PWA     │       │ PWA     │        │ PWA     │
│ YT embed│       │ YT embed│        │ YT embed│
└────┬────┘       └────┬────┘        └────┬────┘
     │   supabase-js: RPC calls + Realtime subscriptions
     └─────────────────┼───────────────────┘
                       ▼
              ┌──────────────────┐
              │     Supabase     │
              │ Auth (anonymous) │
              │ Postgres + RLS   │
              │ SQL functions    │
              │ Realtime/Presence│
              └──────────────────┘
```

Rule: clients **read** tables (RLS-filtered) and **write only through RPCs**. Nobody updates `rooms` or `songs` directly.

## 4. Data model (see `schema.sql`)

| Table | Purpose |
|---|---|
| `rooms` | code, host, status (`active`/`idle`/`closed`), `current_song_id`, `is_playing`, `anchor_pos_ms`, `anchor_time`, `state_version` |
| `room_members` | who is in a room, display name, `joined_at`, `is_kicked` |
| `member_seen` | heartbeat timestamps. Separate table so heartbeats never fire realtime events |
| `songs` | queue items: `video_id`, `title`, `thumbnail`, `added_by`, `position` (double, for ordering) |
| `messages` | chat and system lines (`kind` = `user` or `system`) |

## 5. Server functions (RPC)

All are `security definer` and check membership first.

| Function | Behavior |
|---|---|
| `create_room(p_name)` | Makes a unique 6-char code, creates the room, caller becomes member and host. Returns `{id, code}` |
| `join_room(p_code, p_name)` | Validates code, blocks closed rooms, kicked users, and full rooms. Adds member (or refreshes name). If nobody was online recently, freezes playback where it was. Reactivates an idle room. Returns `{id, code}` |
| `leave_room(p_room)` | Removes member. Host leaving passes host to the longest-present online member. Last person leaving sets room `idle` and paused |
| `heartbeat(p_room)` | Called every ~15 s. Also takes over host if the host has been silent for 40 s (only the longest-joined online member wins) |
| `kick_member`, `close_room` | Host only |
| `add_song(p_room, p_video, p_title)` | Validates the 11-char ID, builds the thumbnail URL server-side, appends to the queue, auto-starts if nothing is selected |
| `remove_song(p_song)` | If it was current, moves to the next song |
| `reorder_song(p_song, p_pos)` | Sets the `position` value |
| `playback(p_room, 'play' \| 'pause' \| 'seek', p_pos)` | Re-anchors playback state using the database clock |
| `play_song(p_room, p_song)` | Jump to a specific queue item |
| `next_song(p_room, p_version)` / `prev_song(...)` | Ignored if `p_version` is stale (prevents double skips). Previous restarts the song if more than 5 s in |
| `song_ended(p_room, p_song, p_error)` | Any client may report. Acts only if that song is still current, so duplicates are harmless. `p_error = true` posts a "couldn't play, skipped" chat line |
| `send_message(p_room, p_text)` | 500-char limit, light rate limit |
| `get_server_time()` | Epoch ms, used for clock offset |

## 6. Realtime

One channel per room: `room:<room_id>`, with Presence keyed by user ID.

| What | Subscription |
|---|---|
| Playback state | `UPDATE` on `rooms`, filter `id=eq.<room_id>` |
| Queue | any change on `songs`, then **refetch the list** (DELETE events cannot be filtered, so refetching is simplest and safe) |
| Members | any change on `room_members`, then refetch |
| Chat | `INSERT` on `messages`, filter `room_id=eq.<room_id>` |
| Online dots | Presence `sync` event |

On every (re)subscribe, load a full snapshot (room, songs, members, last 100 messages). This also repairs state after a dropped connection or a phone waking up.

## 7. Sync algorithm

The `rooms` row is the single source of truth:

```
anchor_pos_ms = playback position when state last changed
anchor_time   = database time when state last changed
```

**Clock offset (on join, then every ~5 min):** call `get_server_time()` 5 times, keep the sample with the lowest round trip, `offset = serverMs + rtt/2 - clientNow`.

**Expected position:**

```
expected = anchor_pos_ms + (is_playing ? Date.now() + offset - anchor_time : 0)
```

**Drift loop (every ~2 s while playing):** if the player is playing and `abs(player.getCurrentTime()*1000 - expected) > 300`, call `seekTo(expected)`. Skip while buffering and for 2.5 s after the last correction.

**Apply state** whenever the room row or songs list changes:
- Different song than loaded: `loadVideoById(id, startSeconds)` if playing, else `cueVideoById`.
- Same song: play, pause, or seek as needed.
- No current song: stop the player.
- Wait for the user's first tap ("Tap to join the music") before touching the player, because browsers block autoplay until then.

Friends in different places will land within roughly 0.3 to 1 s of each other, which is fine for remote listening.

## 8. Presence, leaving, host transfer

- **Online/offline** comes from Presence. **Membership** is stored in `room_members`. A disconnect leaves the member in the room as offline.
- **Leave** is explicit (`leave_room`). The room keeps running for everyone else.
- **Host transfer** happens inside `leave_room` (instant) or `heartbeat` (after 40 s of host silence).
- **Everyone gone:** the last `leave_room` pauses and idles the room. If everyone just disconnects, the next `join_room` freezes playback at the last known position.
- **Cleanup:** optional `pg_cron` job in `schema.sql` deletes rooms with no heartbeat for 24 h.

## 9. YouTube handling

- **Link parsing (client):** accept `youtu.be/ID`, `youtube.com/watch?v=ID`, `music.youtube.com/watch?v=ID`, `/shorts/ID`, `/embed/ID`, `/live/ID`, or a bare 11-char ID. Validate with `^[A-Za-z0-9_-]{11}$`. Allow several links pasted at once.
- **Title:** `GET https://www.youtube.com/oembed?format=json&url=<watch url>`. If it returns an error status, tell the user the video can't be played here (private or embedding disabled). If the request itself fails (network or CORS), fall back to the title "YouTube video <id>".
- **Player:** one `YT.Player`, `playsinline`, no controls, created after the room screen is visible. Keep it rendered in a small box covered by a thumbnail overlay; never `display:none`. A "Show video" toggle removes the cover.
- **Errors:** `onError` and `onStateChange(ENDED)` both call `song_ended`.
- **Lock screen:** Media Session API with title, thumbnail, and play, pause, next, previous handlers that call the RPCs.

## 10. PWA

- `manifest.webmanifest`: `display: standalone`, `start_url: "."`, theme and background colors, 192 and 512 px icons (one maskable).
- Service worker: cache the app shell, network-first so updates arrive on the next open. `vite-plugin-pwa` generates this.
- Must be served over HTTPS (any static host does this). `localhost` works for development.
- Android Brave/Chrome: menu, "Install app" or "Add to Home screen". iPhone: Share, "Add to Home Screen".
- **Share link format:** `https://<site>/?join=<CODE>` (a query string, so the static host needs no routing rules).

## 11. Project structure

```
jam-room/
  context.md
  architecture.md
  schema.sql
  .env.example            # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
  index.html
  vite.config.ts          # includes vite-plugin-pwa config
  public/                 # icons
  src/
    main.tsx
    App.tsx               # Home vs Room
    lib/
      supabase.ts         # client + anonymous sign-in
      sync.ts             # clock offset, expected position, drift loop
      youtube.ts          # link parser, oEmbed, player wrapper
      api.ts              # typed wrappers for every RPC
    state/roomStore.ts    # room, songs, members, messages, online set
    hooks/
      useRoom.ts          # join, snapshot, subscribe, heartbeat, reconnect
      usePlayer.ts        # connects the YT player to room state
    components/
      Home.tsx            # name, create, join, install button
      Room.tsx
      MemberBar.tsx
      NowPlaying.tsx      # cover, prev / play / next, seek bar
      Queue.tsx           # add bar + sortable list
      Chat.tsx
      UnlockOverlay.tsx   # "Tap to join the music"
```

## 12. One-time Supabase setup

1. Create a Supabase project.
2. Authentication, Sign In / Providers: turn on **Allow anonymous sign-ins**.
3. SQL Editor: paste and run all of `schema.sql`.
4. Copy the project URL and the public (anon/publishable) key into `.env`.
5. Optional: enable `pg_cron` and run the commented cleanup job at the bottom of `schema.sql`.

Note: `schema.sql` has not yet been run against a live project. If the first run reports an error, fix that statement and rerun.

## 13. Testing plan

1. Two tabs, one room: pasted link plays in both, pause, seek, and skip propagate.
2. Phone plus laptop: check real drift.
3. Close the host's tab: host moves to another member after about 40 s and music continues.
4. Everyone leaves, then one person rejoins: room resumes paused.
5. Two people press Next together: only one skip happens.
6. Add a private or embed-disabled video: it is rejected on add, or skipped with a chat note if it fails during play.
7. Lock the screen for 10+ minutes in Brave on each friend's phone (background play).

## 14. Build order for Claude Code

Give Claude Code `context.md`, `architecture.md`, and `schema.sql`, then work one milestone per prompt:

1. **Scaffold:** Vite + React + TS, Supabase client, anonymous sign-in, Home screen (name, create, join), PWA config and icons.
2. **Room core:** join flow, snapshot load, realtime subscriptions, member bar with Presence.
3. **Player and sync:** YT player wrapper, unlock overlay, apply-state logic, clock offset, drift loop, play/pause/seek.
4. **Queue:** add (link parsing and oEmbed), remove, click to play, drag reorder, next, previous, auto-advance, error skip.
5. **Chat and lifecycle:** chat panel with unread badge, heartbeat, leave, kick, close, host transfer.
6. **Polish:** design pass with the frontend-design skill, Media Session, install button, background-play testing, deploy.

## 15. Known limits

- Background playback depends on the browser (Brave on Android with its background-play setting on is the best bet; iOS is stricter).
- A free Supabase project pauses after about a week of no activity. Open the dashboard to resume it.
- Remote friends will not be sample-accurate; this is for listening together, not for playing from several speakers in one room.
