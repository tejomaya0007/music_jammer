import { useState, type FormEvent } from 'react';
import { createRoom, discardPendingRoom, getStoredName, joinByCode, openPendingRoom } from '../state/session';
import { toast, useRoomStore } from '../state/roomStore';
import { shareUrl } from '../lib/share';

type Mode = 'start' | 'join';

/**
 * First screen. Order: your name, then the two choices pinned to the bottom.
 * Create shows the new room's code first; Open room enters it.
 */
export function Home({ inviteCode }: { inviteCode: string | null }) {
  const pending = useRoomStore((s) => s.pendingRoom);
  const [name, setName] = useState(getStoredName());
  const [code, setCode] = useState((inviteCode ?? '').toUpperCase());
  const [mode, setMode] = useState<Mode>(inviteCode ? 'join' : 'start');
  const [busy, setBusy] = useState(false);

  if (pending) return <RoomReady code={pending.code} />;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const onCreate = () => {
    if (!name.trim()) return toast('Add your name to start', 'error');
    void run(() => createRoom(name));
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    void run(() => joinByCode(code, name));
  };

  return (
    <main className="home">
      <header className="home-head">
        <h1 className="wordmark">Jam <em>Room</em></h1>
        <p className="lede">Listen to YouTube together, in sync. Works from wherever your friends are.</p>
      </header>

      <label className="field">
        <span>Your name</span>
        <input
          className="input big"
          value={name}
          maxLength={30}
          placeholder="What friends will call you"
          onChange={(e) => setName(e.target.value)}
          autoComplete="nickname"
        />
      </label>

      {mode === 'start' ? (
        <div className="home-actions">
          <button className="btn primary big-btn" disabled={busy} onClick={onCreate}>Create a room</button>
          <button className="btn ghost-line big-btn" disabled={busy} onClick={() => setMode('join')}>Join a room</button>
        </div>
      ) : (
        <form className="home-actions" onSubmit={onJoin}>
          <label className="field">
            <span>Room code</span>
            <input
              className="input code big"
              value={code}
              maxLength={6}
              placeholder="ABC123"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button className="btn primary big-btn" type="submit" disabled={busy || !code.trim()}>Join the room</button>
          <button className="btn ghost" type="button" onClick={() => setMode('start')}>Back</button>
        </form>
      )}
    </main>
  );
}

/** Shown right after Create: the code and link, then Open room. */
function RoomReady({ code }: { code: string }) {
  const [busy, setBusy] = useState(false);

  const copy = async () => {
    const url = shareUrl(code);
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied. Send it to your friends.');
    } catch {
      toast(`Share this code: ${code}`);
    }
  };

  const open = async () => {
    setBusy(true);
    try {
      await openPendingRoom();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="home ready">
      <header className="home-head">
        <h1 className="ready-title">Your room is ready</h1>
        <div className="code-big num" aria-label={`Room code ${code}`}>{code}</div>
        <p className="lede">Send this code or the link to your friends. They can join any time while the room is open.</p>
      </header>
      <div className="home-actions">
        <button className="btn primary big-btn" disabled={busy} onClick={() => void open()}>Open room</button>
        <button className="btn ghost-line big-btn" onClick={() => void copy()}>Copy invite link</button>
        <button className="btn ghost" onClick={() => void discardPendingRoom()}>Back</button>
      </div>
    </main>
  );
}
