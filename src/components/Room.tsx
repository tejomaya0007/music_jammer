import { useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { useMediaSession } from '../hooks/useMediaSession';
import { selectOnlineCount, selectCurrentSong, toast, useRoomStore } from '../state/roomStore';
import { leaveRoom, playPause } from '../state/session';
import { shareUrl } from '../lib/share';
import { Wordmark } from './brand/Wordmark';
import { Stage } from './stage/Stage';
import { VideoDock } from './stage/VideoDock';
import { Queue } from './Queue';
import { ChatPanel } from './Chat';
import { MemberStack, MemberPanel } from './People';
import { InviteSheet } from './InviteSheet';
import { PauseGlyph, PlayGlyph } from './skins/glyphs';

export type RoomTab = 'player' | 'queue' | 'chat';

/**
 * The room. One layout, three arrangements:
 *  - phone and tablet: one panel at a time (Player, Queue, Chat tabs), mini-player above the tab bar
 *  - desktop (1024 px and up): the stage on the left, the rail (Queue above, Chat below) on the right
 * All panels stay mounted, so the YouTube player is never reloaded when the tab changes.
 */
export function Room() {
  const code = useRoomStore((s) => s.code);
  const online = useRoomStore((s) => s.online);
  const onlineCount = useRoomStore(selectOnlineCount);
  const unread = useRoomStore((s) => s.unread);
  const song = useRoomStore(selectCurrentSong);
  const isPlaying = useRoomStore((s) => s.room?.is_playing ?? false);
  const [tab, setTab] = useState<RoomTab>('player');
  const [showVideo, setShowVideo] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  usePlayer(mountRef);
  useMediaSession();

  const tabs = useMemo<Array<{ id: RoomTab; label: string; badge?: number }>>(
    () => [
      { id: 'player', label: 'Player' },
      { id: 'queue', label: 'Queue' },
      { id: 'chat', label: 'Chat', badge: unread },
    ],
    [unread],
  );

  const share = async () => {
    if (!code) return;
    const url = shareUrl(code);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Jam Room', text: `Join my jam with code ${code}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Link copied');
    } catch {
      toast(`Share this code: ${code}`);
    }
  };

  return (
    <div className="room" data-tab={tab}>
      <header className="room-header">
        <Wordmark size="sm" />
        <span className="code-line num" aria-label={`Room code ${code}`}>{code}</span>
        <span className="spacer" />
        <MemberStack
          online={online}
          onOpen={() => setPeopleOpen(true)}
          onlineCount={onlineCount}
        />
        <button type="button" className="btn secondary-sm" onClick={() => setInviteOpen(true)}>Invite</button>
        <button type="button" className="btn ghost leave" onClick={() => void leaveRoom()}>Leave</button>
      </header>

      <div className="room-body">
        <div className="stage-col">
          <Stage showVideo={showVideo} onToggleVideo={() => setShowVideo((v) => !v)} />
        </div>
        <aside className="rail" aria-label="Queue and chat">
          <div className="rail-queue"><Queue /></div>
          <div className="rail-chat"><ChatPanel /></div>
        </aside>
      </div>

      <VideoDock mountRef={mountRef} open={showVideo} onClose={() => setShowVideo(false)} />

      {tab !== 'player' && song && (
        <div className="mini" aria-label="Now playing">
          <img className="mini-art" src={song.thumbnail ?? ''} alt="" />
          <span className="mini-title" title={song.title}>{song.title}</span>
          <button type="button" className="icon-btn" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={() => void playPause()}>
            {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
          </button>
        </div>
      )}

      <nav className="tabbar" aria-label="Room sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${tab === t.id ? ' on' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span>{t.label}</span>
            {t.badge ? <span className="tab-badge num" aria-label={`${t.badge} unread`}>{t.badge}</span> : null}
          </button>
        ))}
      </nav>

      {peopleOpen && <MemberPanel onClose={() => setPeopleOpen(false)} />}
      {inviteOpen && <InviteSheet code={code ?? ''} onShare={() => void share()} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}
