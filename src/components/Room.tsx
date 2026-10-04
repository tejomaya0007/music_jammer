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
import { CrownIcon, ShareIcon } from './icons';

const STACK_MAX = 4;

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

  // online people first, so the stack shows who is actually around
  const ordered = useMemo(
    () => [...members].sort((a, b) => Number(online.includes(b.user_id)) - Number(online.includes(a.user_id))),
    [members, online],
  );
  const shown = ordered.slice(0, STACK_MAX);
  const hidden = ordered.length - shown.length;

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
        <div className="brand">
          <span className="wordmark">Jam <em>Room</em></span>
          <span className="code-line num" aria-label={`Room code ${code}`}>{code}</span>
        </div>

        <button className="people" onClick={() => setPeopleOpen(true)} aria-label={`${onlineCount} online. Open the member list.`}>
          <span className="stack">
            {shown.map((m) => {
              const isOnline = online.includes(m.user_id);
              return (
                <span key={m.user_id} className={`person${isOnline ? '' : ' offline'}`} data-name={m.name} title={m.name}>
                  <Avatar name={m.name} id={m.user_id} online={isOnline} />
                  {m.user_id === hostId && <CrownIcon className="crown" />}
                </span>
              );
            })}
            {hidden > 0 && <span className="more num">+{hidden}</span>}
          </span>
          <span className="count num">{onlineCount} online</span>
        </button>

        <button className="icon-btn" onClick={() => void share()} aria-label="Share the room link">
          <ShareIcon />
        </button>
        <button className="btn ghost leave" onClick={() => void leaveRoom()}>Leave</button>
      </header>

      <main className="screen">
        <NowPlaying mountRef={mountRef} />
        <Queue />
      </main>

      <ChatBar />
      {peopleOpen && <PeopleSheet onClose={() => setPeopleOpen(false)} />}
    </div>
  );
}
