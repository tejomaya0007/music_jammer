import { AVATAR_COLOR_IDS, AVATAR_COLORS, AVATAR_ICONS, formatAvatar, randomAvatar, type Avatar, type AvatarColor, type AvatarIcon } from '../../lib/avatars';
import { AvatarArt } from './icons';

/** Pick a face: 12 icons in a grid, 8 ring colours, a large live preview, and "Surprise me". */
export function AvatarPicker({ value, onChange }: { value: Avatar; onChange: (a: Avatar) => void }) {
  return (
    <div className="picker">
      <div className="picker-preview" aria-hidden="true">
        <div className="picker-preview-disc" style={{ boxShadow: `inset 0 0 0 4px ${AVATAR_COLORS[value.color]}` }}>
          <AvatarArt icon={value.icon} />
        </div>
      </div>

      <div className="picker-grid" role="radiogroup" aria-label="Pick a face">
        {AVATAR_ICONS.map((icon: AvatarIcon) => {
          const selected = icon === value.icon;
          return (
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={icon.replace('-', ' ')}
              className={`picker-icon${selected ? ' selected' : ''}`}
              onClick={() => onChange({ ...value, icon })}
            >
              <AvatarArt icon={icon} />
              {selected && <span className="picker-check" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="picker-colors" role="radiogroup" aria-label="Ring colour">
        {AVATAR_COLOR_IDS.map((color: AvatarColor) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={color === value.color}
            aria-label={`${color} ring`}
            className={`picker-color${color === value.color ? ' selected' : ''}`}
            style={{ background: AVATAR_COLORS[color] }}
            onClick={() => onChange({ ...value, color })}
          />
        ))}
      </div>

      <button type="button" className="btn ghost picker-surprise" onClick={() => onChange(randomAvatar())}>
        Surprise me
      </button>
      <span className="sr-only">Selected: {formatAvatar(value).replace(':', ' in ')}</span>
    </div>
  );
}
