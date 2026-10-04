import { setVolume } from '../../state/roomStore';

/** This person's volume (local only). Arrow keys adjust it, as on any slider. */
export function VolumeControl({ value }: { value: number }) {
  return (
    <label className="volume">
      <span className="volume-label">Volume</span>
      <input
        className="range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        aria-label="Volume"
        aria-valuetext={`${value} percent`}
        style={{ ['--p' as string]: `${value}%` }}
        onChange={(e) => setVolume(Number(e.target.value))}
      />
      <span className="volume-value num">{value}</span>
    </label>
  );
}
