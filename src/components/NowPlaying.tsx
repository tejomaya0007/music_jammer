import { useEffect, useState, type RefObject } from 'react';
import { useRoomStore, selectCurrentSong } from '../state/roomStore';
import { currentPosMs, next, playPause, prev, seekTo, unlockMusic } from '../state/session';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon } from './icons';

function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** The hero: a square sleeve with the video underneath, transport, and seek. */
export function NowPlaying({ mountRef }: { mountRef: RefObject<HTMLDivElement | null> }) {
  const song = useRoomStore(selectCurrentSong);
  const addedBy = useRoomStore((s) => (song ? s.members.find((m) => m.user_id === song.added_by)?.name : undefined));
  const isPlaying = useRoomStore((s) => s.room?.is_playing ?? false);
  const unlocked = useRoomStore((s) => s.unlocked);
  const duration = useRoomStore((s) => s.durationSec);
  const hasRoom = useRoomStore((s) => s.room !== null);
  const [showVideo, setShowVideo] = useState(false);
  const [position, setPosition] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);

  // move the seek thumb with the room clock, four times a second
  useEffect(() => {
    const tick = () => setPosition(currentPosMs() / 1000);
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [song?.id, isPlaying]);

  const total = duration || 0;
  const shown = dragging ?? Math.min(position, total || position);
  const pct = total ? Math.min(100, (shown / total) * 100) : 0;

  return (
    <section className="sleeve" aria-label="Now playing">
      <div className="art-wrap">
        {song?.thumbnail ? (
          <img className={`art${showVideo ? ' gone' : ''}`} src={song.thumbnail} alt="" />
        ) : (
          <div className="art-empty" aria-hidden>Nothing playing</div>
        )}
        <div className="player-mount" ref={mountRef} />

        {song && !unlocked && (
          <div className="tap-join" role="group" aria-label="Start playback">
            <strong>Tap to join the music</strong>
            <span>Browsers need one tap before sound can play.</span>
            <button className="btn primary" onClick={unlockMusic}>Join in</button>
          </div>
        )}

        {song && unlocked && (
          <button className="show-video" onClick={() => setShowVideo((v) => !v)} aria-pressed={showVideo}>
            {showVideo ? 'Hide video' : 'Show video'}
          </button>
        )}
      </div>

      <div className="now-meta">
        {song ? (
          <>
            <h2 className="now-title">{song.title}</h2>
            <p className="now-by">Added by {addedBy ?? 'someone'}</p>
          </>
        ) : (
          <p className="idle-title">{hasRoom ? 'Add a link to start the jam' : 'Connecting'}</p>
        )}

        <div className="seek">
          <input
            className="bar"
            type="range"
            min={0}
            max={total || 1}
            step={0.1}
            value={shown}
            disabled={!song || !total}
            aria-label="Seek"
            style={{ ['--p' as string]: `${pct}%` }}
            onChange={(e) => setDragging(Number(e.target.value))}
            onPointerUp={(e) => commitSeek(Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => commitSeek(Number((e.target as HTMLInputElement).value))}
            onBlur={() => setDragging(null)}
          />
          <div className="seek-times">
            <span>{clock(shown)}</span>
            <span>{total ? clock(total) : '--:--'}</span>
          </div>
        </div>

        <div className="transport">
          <button className="tbtn" onClick={() => void prev()} disabled={!song} aria-label="Previous">
            <PrevIcon />
          </button>
          <button className="tbtn big" onClick={() => void playPause()} disabled={!song} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="tbtn" onClick={() => void next()} disabled={!song} aria-label="Next">
            <NextIcon />
          </button>
        </div>
      </div>
    </section>
  );

  function commitSeek(sec: number) {
    if (dragging === null) return;
    setDragging(null);
    void seekTo(sec);
  }
}
