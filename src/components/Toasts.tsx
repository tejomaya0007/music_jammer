import { useRoomStore } from '../state/roomStore';

/** Short messages at the top of the screen. role=status so screen readers announce them. */
export function Toasts() {
  const toasts = useRoomStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.tone === 'error' ? ' error' : ''}`}>{t.text}</div>
      ))}
    </div>
  );
}
