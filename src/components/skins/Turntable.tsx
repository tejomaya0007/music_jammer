import { useEffect, useRef } from 'react';
import { useSpin } from '../../hooks/useSpin';
import { progressOf, type SkinProps } from './types';
import { NextGlyph, PauseGlyph, PlayGlyph, PrevGlyph } from './glyphs';

const SLIDE_MS = 560;

/**
 * Turntable: brushed plinth seen from above, a vinyl platter that spins (33 and a third rpm),
 * a tonearm that moves across the record as the song plays. When the song changes, the old disc
 * slides off to the left and the new one slides in from the right.
 */
export function Turntable({ song, isPlaying, positionMs, durationMs, onPlayPause, onNext, onPrev }: SkinProps) {
  const platter = useRef<HTMLDivElement>(null);
  const disc = useRef<HTMLDivElement>(null);
  const lastThumb = useRef<string | null>(song?.thumbnail ?? null);
  useSpin(isPlaying, platter);

  // slide the disc on a song change (Web Animations, so nothing re-renders per frame)
  useEffect(() => {
    const thumb = song?.thumbnail ?? null;
    const el = disc.current;
    if (!el || thumb === lastThumb.current) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const previous = lastThumb.current;
    lastThumb.current = thumb;
    if (reduced) return;

    if (previous) {
      // a copy of the old disc (it still shows the previous artwork) slides out to the left
      const out = el.cloneNode(true) as HTMLDivElement;
      const img = out.querySelector('img');
      if (img) img.setAttribute('src', previous);
      out.setAttribute('aria-hidden', 'true');
      el.parentElement?.appendChild(out);
      const leave = out.animate(
        [{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(-115%)', opacity: 0.2 }],
        { duration: SLIDE_MS, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' },
      );
      leave.onfinish = () => out.remove();
    }
    el.animate(
      [{ transform: 'translateX(115%)', opacity: 0.2 }, { transform: 'translateX(0)', opacity: 1 }],
      { duration: SLIDE_MS, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
  }, [song?.thumbnail]);

  const p = progressOf(positionMs, durationMs);
  // rest: standing off the record. Playing: lowered onto the outer groove (153.8 degrees),
  // then drifting inward by 16 degrees over the song (the spec's +24 to +40 swing from the groove base)
  // parked up and to the right, clear of the transport buttons below it
  const arm = isPlaying && song ? 153.8 + 16 * p : -30;

  return (
    <div className="tt" role="group" aria-label="Turntable">
      <div className="tt-plinth">
        <div className="tt-disc" ref={disc}>
          <div className="tt-platter" ref={platter}>
            <div className="tt-grooves" />
            <div className="tt-label">
              {song?.thumbnail && <img src={song.thumbnail} alt="" />}
            </div>
          </div>
        </div>
        {/* sheen stays still while the disc turns: light is fixed, the record moves under it */}
        <div className="tt-sheen" aria-hidden="true" />
        <div className="tt-arm" style={{ transform: `rotate(${arm}deg)` }} aria-hidden="true">
          <span className="tt-cartridge" />
        </div>
        <span className="tt-pivot" aria-hidden="true" />

        <div className="tt-controls">
          <button type="button" className="tt-btn tt-start" aria-label={isPlaying ? 'Pause' : 'Play'} aria-pressed={isPlaying} onClick={onPlayPause} disabled={!song}>
            <span className={`tt-led${isPlaying ? ' on' : ''}`} aria-hidden="true" />
            {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
          </button>
          <div className="tt-skip">
            <button type="button" className="tt-btn sm" aria-label="Previous song" onClick={onPrev} disabled={!song}><PrevGlyph /></button>
            <button type="button" className="tt-btn sm" aria-label="Next song" onClick={onNext} disabled={!song}><NextGlyph /></button>
          </div>
        </div>

        <span className="tt-power" aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}
