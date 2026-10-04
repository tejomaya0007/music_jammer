import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRoomStore } from '../state/roomStore';
import { sendChat } from '../state/session';
import { CHAT_MAX } from '../lib/config';
import { Avatar } from './avatar/Avatar';

const GROUP_MS = 2 * 60 * 1000;

type ChatRow =
  | { kind: 'system'; id: string; text: string }
  | { kind: 'user'; id: string; text: string; mine: boolean; grouped: boolean; who: string; at: string; avatar: string | null };

/** Chat: a visible panel. Consecutive lines from one person group under one header. */
export function ChatPanel() {
  const messages = useRoomStore((s) => s.messages);
  const members = useRoomStore((s) => s.members);
  const userId = useRoomStore((s) => s.userId);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  // group consecutive lines from one person within two minutes (computed once per change, not during render)
  const rows = useMemo(() => {
    const out: ChatRow[] = [];
    let prev: { key: string; at: number } | null = null;
    for (const m of messages) {
      if (m.kind === 'system') {
        out.push({ kind: 'system', id: m.id, text: m.text });
        prev = null;
        continue;
      }
      const at = new Date(m.created_at).getTime();
      const key = m.user_id ?? '';
      const grouped = prev !== null && prev.key === key && at - prev.at < GROUP_MS;
      prev = { key, at };
      const mine = m.user_id === userId;
      out.push({
        kind: 'user', id: m.id, text: m.text, mine, grouped,
        who: mine ? 'You' : m.name ?? 'Someone', at: m.created_at,
        avatar: members.find((x) => x.user_id === m.user_id)?.avatar ?? null,
      });
    }
    return out;
  }, [messages, members, userId]);

  // follow new messages only if the reader is already at the bottom
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [messages.length, atBottom]);

  const jumpDown = () => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    setAtBottom(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      if (await sendChat(text)) setText('');
    } finally {
      setSending(false);
    }
  };


  return (
    <section className="chat" aria-label="Chat">
      <header className="panel-head">
        <h2 className="panel-title">Chat</h2>
      </header>

      <div
        className="chat-list"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
        }}
      >
        {messages.length === 0 && <p className="empty">Say something. Everyone in the room sees it.</p>}
        {rows.map((r) =>
          r.kind === 'system' ? (
            <p key={r.id} className="sys">{r.text}</p>
          ) : (
            <div key={r.id} className={`msg${r.mine ? ' mine' : ''}${r.grouped ? ' grouped' : ''}`}>
              {!r.grouped && (
                <div className="msg-head">
                  {!r.mine && <Avatar value={r.avatar} name={r.who} size={28} />}
                  <span className="who">{r.who}</span>
                  <time className="when num" dateTime={r.at}>
                    {new Date(r.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </time>
                </div>
              )}
              <div className="bubble">{r.text}</div>
            </div>
          ),
        )}
      </div>

      {!atBottom && (
        <button type="button" className="new-msgs" onClick={jumpDown}>New messages</button>
      )}

      <form className="composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="chat-input">Message</label>
        <input
          id="chat-input"
          className="input"
          value={text}
          maxLength={CHAT_MAX}
          placeholder="Message the room"
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
        />
        {text.length > 450 && <span className="count-chip num">{CHAT_MAX - text.length}</span>}
        <button type="submit" className="btn primary send" disabled={!text.trim() || sending} aria-label="Send">
          Send
        </button>
      </form>
    </section>
  );
}
