import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from './icons';
import { toneFor } from '../lib/avatar';

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
