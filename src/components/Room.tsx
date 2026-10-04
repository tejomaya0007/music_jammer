import { useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { useMediaSession } from '../hooks/useMediaSession';
import { useRoomStore, selectCurrentSong, selectOnlineCount, toast } from '../state/roomStore';
import { leaveRoom } from '../state/session';
import { shareUrl } from '../lib/share';
import { NowPlaying } from './NowPlaying';
import { Queue } from './Queue';
import { ChatBar } from './Chat';
import { PeopleSheet } from './People';
import { Avatar } from './parts';
import { CrownIcon, ShareIcon, PeopleIcon } from './icons';

export function Room() {
  const code = useRoomStore((s) => s.code);
  const allMembers = useRoomStore((s) => s.members);
  const members = useMemo(() => allMembers.filter((m) => !m.is_kicked), [allMembers]);
  const online = useRoomStore((s) => s.online);
  const hostId = useRoomStore((s) => s.room?.host_id ?? null);
  const onlineCount = useRoomStore(selectOnlineCount);
  const art = useRoomStore(selectCurrentSong)?.thumbnail ?? null;
  const [peopleOpen, setPeopleOpen] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  usePlayer(mountRef);
  useMediaSession();

  const share = async () => {
    if (!code) return;
    const url = shareUrl(code);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Jam Room', text: `Join my jam with code ${code}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Link copied. Send it to your friends.');
    } catch {
      toast(`Share this code: ${code}`);
    }
  };

  return (
    <div className="app">
      {art && <div className="ambient" style={{ backgroundImage: `url(${art})` }} aria-hidden />}
      <header className="topbar">
        <span className="wordmark" style={{ fontSize: '1.5rem' }}>Jam <em style={{ color: 'var(--gold)' }}>Room</em></span>
        <span className="spacer" />
        <span className="code-chip num" aria-label={`Room code ${code}`}>{code}</span>
        <button className="icon-btn" onClick={() => void share()} aria-label="Share the room link">
          <ShareIcon />
        </button>
        <button className="btn ghost" onClick={() => void leaveRoom()}>Leave</button>
      </header>

      <main className="screen">
        <button className="people" onClick={() => setPeopleOpen(true)} aria-label={`${onlineCount} online. Open the member list.`}>
          {members.map((m) => (
            <span key={m.user_id} className={`person${online.includes(m.user_id) ? '' : ' offline'}`} style={{ cursor: 'pointer' }}>
              <Avatar name={m.name} id={m.user_id} online={online.includes(m.user_id)} />
              {m.name}
              {m.user_id === hostId && <CrownIcon className="crown" />}
            </span>
          ))}
          <span className="count num">{onlineCount} online</span>
          <PeopleIcon style={{ width: 16, height: 16, color: 'var(--muted)' }} aria-hidden />
        </button>

        <NowPlaying mountRef={mountRef} />
        <Queue />
      </main>

      <ChatBar />
      {peopleOpen && <PeopleSheet onClose={() => setPeopleOpen(false)} />}
    </div>
  );
}
