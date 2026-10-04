import { useState } from 'react';
import { seekTo } from '../../state/session';
import { clock } from '../../lib/time';

/** Shared seek bar: 4 px track, 16 px amber thumb, elapsed and total in mono (DESIGN.md 7.0). */
export function SeekBar({ positionSec, durationSec, disabled }: { positionSec: number; durationSec: number; disabled: boolean }) {
  const [dragging, setDragging] = useState<number | null>(null);
  const known = durationSec > 0;
  const shown = dragging ?? (known ? Math.min(positionSec, durationSec) : 0);
  const pct = known ? Math.min(100, (shown / durationSec) * 100) : 0;

  const commit = (v: number) => {
    setDragging(null);
    void seekTo(v);
  };

  return (
    <div className="seek">
      <input
        className="range seek-range"
        type="range"
        min={0}
        max={known ? durationSec : 1}
        step={0.1}
        value={shown}
        disabled={disabled || !known}
        aria-label="Seek"
        aria-valuetext={`${clock(shown)} of ${clock(durationSec)}`}
        style={{ ['--p' as string]: `${pct}%` }}
        onChange={(e) => setDragging(Number(e.target.value))}
        onPointerUp={(e) => dragging !== null && commit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => dragging !== null && commit(Number((e.target as HTMLInputElement).value))}
        onBlur={() => setDragging(null)}
      />
      <div className="seek-times num">
        <span>{clock(shown)}</span>
        <span>{known ? clock(durationSec) : '--:--'}</span>
      </div>
    </div>
  );
}
