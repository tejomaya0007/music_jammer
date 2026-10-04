import { AVATAR_COLORS, parseAvatar } from '../../lib/avatars';
import { AvatarArt } from './icons';

/** Stable warm colour for a person with no avatar: the first letter on a chrome disc. */
export function Avatar({
  value, name, size = 32, online, host, className = '',
}: {
  value: string | null | undefined;
  name: string;
  size?: 24 | 28 | 32 | 44 | 96;
  online?: boolean;
  host?: boolean;
  className?: string;
}) {
  const a = parseAvatar(value);
  const style = { width: size, height: size } as const;
  const initial = (name.trim()[0] ?? '?').toUpperCase();

  return (
    <span className={`avatar s${size} ${className}`.trim()} style={style} title={name} data-name={name}>
      {a ? (
        <span
          className="avatar-disc"
          style={{ boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size / 16))}px ${AVATAR_COLORS[a.color]}` }}
        >
          <AvatarArt icon={a.icon} />
        </span>
      ) : (
        <span className="avatar-disc initial" aria-hidden="true">{initial}</span>
      )}
      {online !== undefined && <span className={`presence${online ? ' on' : ''}`} aria-hidden="true" />}
      {host && <span className="host-badge" aria-hidden="true" />}
    </span>
  );
}
