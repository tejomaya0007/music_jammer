import { useRef } from 'react';
import { useSpin } from '../../hooks/useSpin';
import { progressOf, type SkinProps } from './types';
import { NextGlyph, PauseGlyph, PlayGlyph, PrevGlyph } from './glyphs';

/**
 * Turntable: brushed plinth seen from above, a vinyl platter that spins (33 and a third rpm),
 * a tonearm that moves across the record as the song plays. Fader = volume.
 */
export function Turntable({ song, isPlaying, positionMs, durationMs, volume, onPlayPause, onNext, onPrev, onVolume }: SkinProps) {
  const platter = useRef<HTMLDivElement>(null);
  useSpin(isPlaying, platter);
  const p = progressOf(positionMs, durationMs);
  // rest: 90 degrees, standing off the record. Playing: lowered onto the outer groove (153.8 degrees),
  // then drifting inward by 16 degrees over the song (the spec's +24 to +40 swing from the groove base)
  const arm = isPlaying && song ? 153.8 + 16 * p : 90;

  return (
    <div className="tt" role="group" aria-label="Turntable">
      <div className="tt-plinth">
        <div className="tt-platter" ref={platter}>
          <div className="tt-grooves" />
          <div className="tt-label">
            {song?.thumbnail && <img src={song.thumbnail} alt="" />}
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

        <div className="tt-fader">
          <input
            className="range vertical"
            type="range"
            min={0}
            max={100}
            value={volume}
            aria-label="Volume"
            aria-valuetext={`${volume} percent`}
            onChange={(e) => onVolume(Number(e.target.value))}
          />
        </div>
        <span className="tt-power" aria-hidden="true"><span /></span>
      </div>
    </div>
  );
}
