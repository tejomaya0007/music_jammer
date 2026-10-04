import { useState } from 'react';
import { Sheet } from './ui/Sheet';
import { shareUrl } from '../lib/share';
import { toast } from '../state/roomStore';

/** Invite: the code, copy link, share. Opened from the room header. */
export function InviteSheet({ code, onShare, onClose }: { code: string; onShare: () => void; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl(code));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(`Share this code: ${code}`);
    }
  };

  return (
    <Sheet title="Invite friends" onClose={onClose}>
      <p className="invite-code num" aria-label={`Room code ${code}`}>{code.split('').join(' ')}</p>
      <p className="lede">They can join with this code, or with the link.</p>
      <div className="card-actions">
        <button type="button" className="btn primary" onClick={() => void copyLink()}>{copied ? 'Copied' : 'Copy link'}</button>
        {canShare && <button type="button" className="btn" onClick={onShare}>Share</button>}
      </div>
    </Sheet>
  );
}
