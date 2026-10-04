import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Wordmark } from '../components/brand/Wordmark';
import { tryJoin } from '../state/session';
import { readProfile } from '../lib/profile';

/** The code alphabet has no 0, O, 1, I, L (context.md 4.2). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LEN = 6;

const clean = (s: string): string => s.toUpperCase().split('').filter((c) => CODE_ALPHABET.includes(c)).join('');

/** Six character boxes: auto-advance, backspace moves back, paste fills all six. */
export function JoinCode({ initial = '', onBack }: { initial?: string; onBack: () => void }) {
  const [chars, setChars] = useState<string[]>(() => {
    const seed = clean(initial).slice(0, LEN);
    return Array.from({ length: LEN }, (_, i) => seed[i] ?? '');
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const code = chars.join('');
  const full = code.length === LEN && chars.every(Boolean);

  const setAt = (i: number, v: string) => {
    setChars((prev) => prev.map((c, j) => (j === i ? v : c)));
    setError(null);
  };

  const fillFrom = (start: number, text: string) => {
    const incoming = clean(text);
    setChars((prev) => prev.map((c, j) => (j >= start && incoming[j - start] ? incoming[j - start] : c)));
    setError(null);
    const next = Math.min(start + incoming.length, LEN - 1);
    refs.current[next]?.focus();
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
      setAt(i - 1, '');
      e.preventDefault();
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < LEN - 1) refs.current[i + 1]?.focus();
    if (e.key === 'Enter' && full) void join();
  };

  const onChange = (i: number, raw: string) => {
    const v = clean(raw).slice(-1);
    if (!v) return setAt(i, '');
    setAt(i, v);
    if (i < LEN - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (i: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    fillFrom(i, e.clipboardData.getData('text'));
  };

  const join = async () => {
    const profile = readProfile();
    if (!profile) return setError('Add your name first.');
    setBusy(true);
    const err = await tryJoin(code, profile.name);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <main className="stage-page">
      <Wordmark />
      <section className="card join-card" aria-labelledby="join-title">
        <h1 id="join-title" className="h-display">Join with a code</h1>
        <p className="lede">Type the six characters, or paste a code or link.</p>

        <div className="code-boxes" role="group" aria-label="Room code, six characters">
          {chars.map((c, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              className={`code-box${error ? ' invalid' : ''}`}
              value={c}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label={`Character ${i + 1} of ${LEN}`}
              autoFocus={i === 0}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={(e) => onPaste(i, e)}
              onFocus={(e) => e.currentTarget.select()}
            />
          ))}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="card-actions">
          <button type="button" className="btn ghost" onClick={onBack}>Back</button>
          <button type="button" className="btn primary block" disabled={!full || busy} onClick={() => void join()}>
            Join room
          </button>
        </div>
      </section>
    </main>
  );
}
