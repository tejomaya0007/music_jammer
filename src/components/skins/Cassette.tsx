import { clock } from '../../lib/time';
import { progressOf, type SkinProps } from './types';
import { NextGlyph, PauseGlyph, PlayGlyph, PrevGlyph } from './glyphs';

/**
 * Cassette: charcoal shell, paper label, two reels behind a window. The tape pack moves from
 * one reel to the other as the song plays. Keys are the transport; the fader is volume.
 */
export function Cassette({ song, isPlaying, positionMs, durationMs, volume, onPlayPause, onNext, onPrev, onVolume }: SkinProps) {
  const p = progressOf(positionMs, durationMs);
  // the full pack shrinks on the left reel as the tape moves over; the empty side grows on the right
  const left = 62 - 26 * p;
  const right = 26 + 26 * p;
  const reelSpeed = isPlaying ? '1.1s' : 'paused';

  return (
    <div className="cs" role="group" aria-label="Cassette">
      <div className="cs-shell">
        <div className="cs-label">
          <div className="cs-thumb">{song?.thumbnail && <img src={song.thumbnail} alt="" />}</div>
          <div className="cs-text">
            <span className="cs-title" title={song?.title}>{song?.title ?? 'Nothing playing'}</span>
            <span className="cs-side">Side A</span>
          </div>
          <span className="cs-len num">{durationMs > 0 ? clock(durationMs / 1000) : ''}</span>
          <span className="cs-stripe teal" aria-hidden="true" />
          <span className="cs-stripe red" aria-hidden="true" />
        </div>

        <div className="cs-window" aria-hidden="true">
          <span className="cs-pack" style={{ width: `${left}%`, height: `${left}%` }} />
          <span className="cs-pack right" style={{ width: `${right}%`, height: `${right}%` }} />
          <span className="cs-hub" style={{ animationPlayState: reelSpeed }} />
          <span className="cs-hub right" style={{ animationPlayState: reelSpeed }} />
        </div>

        <div className="cs-bottom" aria-hidden="true">
          <span className="cs-hole" /><span className="cs-hole" />
        </div>
      </div>

      <div className="cs-keys">
        <button type="button" className="cs-key" aria-label="Previous song" onClick={onPrev} disabled={!song}><PrevGlyph /></button>
        <button type="button" className={`cs-key play${isPlaying ? ' down' : ''}`} aria-label={isPlaying ? 'Pause' : 'Play'} aria-pressed={isPlaying} onClick={onPlayPause} disabled={!song}>
          {isPlaying ? <PauseGlyph /> : <PlayGlyph />}
        </button>
        <button type="button" className="cs-key" aria-label="Next song" onClick={onNext} disabled={!song}><NextGlyph /></button>
      </div>

      <div className="cs-fader">
        <input
          className="range"
          type="range"
          min={0}
          max={100}
          value={volume}
          aria-label="Volume"
          aria-valuetext={`${volume} percent`}
          onChange={(e) => onVolume(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
