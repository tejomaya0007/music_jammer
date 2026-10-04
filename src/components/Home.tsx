import { useState, type FormEvent } from 'react';
import { createRoom, getStoredName, joinByCode } from '../state/session';

/** First screen: pick a name, then start a jam or join one by code. */
export function Home({ inviteCode }: { inviteCode: string | null }) {
  const [name, setName] = useState(getStoredName());
  const [code, setCode] = useState((inviteCode ?? '').toUpperCase());
  const [busy, setBusy] = useState(false);

  const submit = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    void submit(() => joinByCode(code, name));
  };

  return (
    <main className="home">
      <header>
        <h1 className="wordmark">Jam<br /><em>Room</em></h1>
        <p className="lede">Listen to YouTube together, in sync, from wherever your friends are.</p>
      </header>

      <div className="home-grid">
        <label className="field">
          <span>Your name</span>
          <input
            className="input"
            value={name}
            maxLength={30}
            placeholder="How friends will see you"
            onChange={(e) => setName(e.target.value)}
            autoComplete="nickname"
          />
        </label>

        <button className="btn primary block" disabled={busy} onClick={() => void submit(() => createRoom(name))}>
          Start a jam
        </button>

        <div className="divider-row">or join one</div>

        <form className="join-row" onSubmit={onJoin}>
          <label className="sr-only" htmlFor="code">Room code</label>
          <input
            id="code"
            className="input code"
            value={code}
            maxLength={6}
            placeholder="ABC123"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
          />
          <button className="btn" type="submit" disabled={busy || !code.trim()}>Join</button>
        </form>
      </div>
    </main>
  );
}
