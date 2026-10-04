import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from './icons';

/** Warm palette for avatars; the colour is picked from the user id so it stays stable. */
const TONES = ['#f2c14e', '#e98b5b', '#9ec5a1', '#c4a6e8', '#7fb8d8', '#e8788a', '#d7c9a6'];

export function toneFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

export function Avatar({ name, id, online }: { name: string; id: string; online?: boolean }) {
  return (
    <span className="avatar" style={{ background: toneFor(id) }} aria-hidden>
      {(name.trim()[0] ?? '?').toUpperCase()}
      {online !== undefined && <span className={`dot${online ? ' on' : ''}`} />}
    </span>
  );
}

/** Bottom sheet with a scrim. Esc and the scrim close it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" aria-hidden />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </>
  );
}
