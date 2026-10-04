import { useState } from 'react';
import { Wordmark } from '../components/brand/Wordmark';
import { discardPendingRoom, openPendingRoom } from '../state/session';
import { toast } from '../state/roomStore';
import { shareUrl } from '../lib/share';

/** The room is created: a ticket stub with the code and link, then Enter room. */
export function RoomReady({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const url = shareUrl(code);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : url);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      toast(`Share this code: ${code}`);
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: 'Jam Room', text: `Join my jam with code ${code}`, url });
    } catch {
      /* cancelled */
    }
  };

  const enter = async () => {
    setBusy(true);
    try {
      await openPendingRoom();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="stage-page">
      <Wordmark />
      <section className="card ticket-wrap" aria-labelledby="ready-title">
        <h1 id="ready-title" className="h-display">Your room is ready</h1>
        <p className="lede">Send this to your friends.</p>

        <div className="ticket" aria-label={`Room code ${code}`}>
          <div className="ticket-code num">{code.split('').join(' ')}</div>
          <div className="ticket-perf" aria-hidden="true" />
          <div className="ticket-link">{url}</div>
        </div>

        <div className="ticket-actions">
          <button type="button" className="btn" onClick={() => void copy('code')}>
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </button>
          <button type="button" className="btn" onClick={() => void copy('link')}>
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </button>
          {canShare && (
            <button type="button" className="btn" onClick={() => void share()}>Share</button>
          )}
        </div>

        <button type="button" className="btn primary block big" disabled={busy} onClick={() => void enter()}>
          Enter room
        </button>
        <button type="button" className="btn ghost block" onClick={() => void discardPendingRoom()}>
          Back
        </button>
      </section>
    </main>
  );
}
