import { useEffect, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { SongRow } from '../../lib/api';
import { clock } from '../../lib/time';
import { progressOf, type SkinProps } from './types';
import { PauseGlyph, PlayGlyph } from './glyphs';

interface IPodProps extends SkinProps {
  addedBy: string;
  songs: SongRow[];
  currentId: string | null;
  onPlaySong: (id: string) => void;
}

const VOLUME_STEP_DEG = 12;
const ROW_STEP_DEG = 20;

/** Angle of a point around the wheel centre, in degrees. */
function angleAt(el: HTMLElement, x: number, y: number): number {
  const r = el.getBoundingClientRect();
  return (Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180) / Math.PI;
}

/**
 * iPod classic: a silver body, a screen (Now Playing / Up next) and a working click wheel.
 * Taps on the printed labels act; a circular drag changes volume (Now Playing) or moves the
 * highlight (Up next). The on-screen progress bar is display only.
 */
export function IPod({ song, addedBy, isPlaying, positionMs, durationMs, volume, onPlayPause, onNext, onPrev, onVolume, songs, currentId, onPlaySong }: IPodProps) {
  const [screen, setScreen] = useState<'now' | 'next'>('now');
  const [highlight, setHighlight] = useState(() => Math.max(0, songs.findIndex((s) => s.id === currentId)));
  const [flash, setFlash] = useState(false);
  const wheel = useRef<HTMLDivElement>(null);
  const drag = useRef<{ last: number; acc: number; moved: boolean } | null>(null);
  const flashTimer = useRef<number | undefined>(undefined);
  const firstVolume = useRef(true);
  const p = progressOf(positionMs, durationMs);

  // the volume read-out appears for 1.5 s whenever the volume changes
  useEffect(() => {
    if (firstVolume.current) {
      firstVolume.current = false; // not on first load, only on a change
      return;
    }
    setFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 1500);
    return () => window.clearTimeout(flashTimer.current);
  }, [volume]);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!wheel.current) return;
    drag.current = { last: angleAt(wheel.current, e.clientX, e.clientY), acc: 0, moved: false };
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !wheel.current) return;
    const now = angleAt(wheel.current, e.clientX, e.clientY);
    let delta = now - d.last;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    d.last = now;
    d.acc += delta;
    if (Math.abs(d.acc) > 4) d.moved = true;
    const step = screen === 'now' ? VOLUME_STEP_DEG : ROW_STEP_DEG;
    while (d.acc >= step) {
      d.acc -= step;
      tick(screen === 'now' ? () => onVolume(Math.min(100, volume + 5)) : () => setHighlight((h) => Math.min(songs.length - 1, h + 1)));
    }
    while (d.acc <= -step) {
      d.acc += step;
      tick(screen === 'now' ? () => onVolume(Math.max(0, volume - 5)) : () => setHighlight((h) => Math.max(0, h - 1)));
    }
  };

  const onUp = () => {
    drag.current = null;
  };

  // a drag must not also count as a tap on a label
  const onClickCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (drag.current?.moved) e.stopPropagation();
  };

  const tick = (fn: () => void) => {
    fn();
    navigator.vibrate?.(4);
  };

  const centre = () => {
    if (screen === 'next') {
      const row = songs[highlight];
      if (row) onPlaySong(row.id);
      setScreen('now');
    } else {
      onPlayPause();
    }
  };

  return (
    <div className="ipod" role="group" aria-label="iPod">
      <div className="ipod-screen">
        <header className="ipod-bar">
          <span className="ipod-bar-icon" aria-hidden="true">{isPlaying ? <PlayGlyph /> : <PauseGlyph />}</span>
          <span className="ipod-bar-title">{screen === 'now' ? 'Now Playing' : 'Up next'}</span>
          <span className="ipod-battery" aria-hidden="true" />
        </header>

        {screen === 'now' ? (
          <div className="ipod-now">
            {song?.thumbnail && <img className="ipod-art" src={song.thumbnail} alt="" />}
            <div className="ipod-now-text">
              <span className="ipod-title" title={song?.title}>{song?.title ?? 'Nothing playing'}</span>
              {song && <span className="ipod-by">Added by {addedBy}</span>}
            </div>
            <div className="ipod-progress" aria-hidden="true"><span style={{ width: `${p * 100}%` }} /></div>
            <div className="ipod-times num" aria-hidden="true">
              <span>{clock(positionMs / 1000)}</span>
              <span>-{clock(Math.max(0, durationMs - positionMs) / 1000)}</span>
            </div>
            {flash && (
              <div className="ipod-volume" aria-hidden="true">
                <span>Volume</span>
                <span className="ipod-volume-bar"><span style={{ width: `${volume}%` }} /></span>
              </div>
            )}
          </div>
        ) : (
          <ol className="ipod-list">
            {songs.map((s, i) => (
              <li
                key={s.id}
                className={`ipod-row${i === highlight ? ' hi' : ''}`}
                onClick={() => { setHighlight(i); onPlaySong(s.id); }}
              >
                <span className="ipod-row-mark" aria-hidden="true">{s.id === currentId ? '▶' : ''}</span>
                <span className="ipod-row-title">{s.title}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div
        ref={wheel}
        className="wheel"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
        onClickCapture={onClickCapture}
      >
        <button type="button" className="wheel-label top" aria-label={screen === 'now' ? 'Show up next' : 'Show now playing'} onClick={() => setScreen(screen === 'now' ? 'next' : 'now')}>Menu</button>
        <button type="button" className="wheel-label left" aria-label="Previous song" onClick={onPrev} disabled={!song}>⏮</button>
        <button type="button" className="wheel-label right" aria-label="Next song" onClick={onNext} disabled={!song}>⏭</button>
        <button type="button" className="wheel-label bottom" aria-label={isPlaying ? 'Pause' : 'Play'} onClick={onPlayPause} disabled={!song}>⏯</button>
        <button type="button" className="wheel-centre" aria-label={screen === 'now' ? (isPlaying ? 'Pause' : 'Play') : 'Play highlighted song'} onClick={centre} />
      </div>
    </div>
  );
}
