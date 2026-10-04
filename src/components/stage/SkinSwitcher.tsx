import type { Skin } from '../../hooks/useSkin';

const LABELS: Record<Skin, string> = { turntable: 'Turntable', cassette: 'Cassette', ipod: 'iPod' };

/** Segmented control to choose the device. Changing it never reloads or pauses the player. */
export function SkinSwitcher({ skin, onChange }: { skin: Skin; onChange: (s: Skin) => void }) {
  const order: Skin[] = ['turntable', 'cassette', 'ipod'];
  return (
    <div className="segmented" role="radiogroup" aria-label="Player style">
      {order.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={skin === s}
          className={skin === s ? 'on' : ''}
          onClick={() => onChange(s)}
        >
          {LABELS[s]}
        </button>
      ))}
    </div>
  );
}
