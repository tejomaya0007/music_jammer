import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRoomStore } from '../state/roomStore';
import { sendChat, setChatOpen } from '../state/session';
import { CHAT_MAX } from '../lib/config';
import { ChatIcon, SendIcon } from './icons';
import { Sheet } from './parts';

/** Collapsed: a bar with an unread count. Open: the message list and a composer. */
export function ChatBar() {
  const unread = useRoomStore((s) => s.unread);
  const open = useRoomStore((s) => s.chatOpen);
  if (open) return <ChatSheet />;
  return (
    <button className="chat-bar" onClick={() => setChatOpen(true)} aria-label={unread ? `Chat, ${unread} unread` : 'Chat'}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ChatIcon /> Chat
      </span>
      {unread > 0 && <span className="badge num">{unread}</span>}
    </button>
  );
}

function ChatSheet() {
  const messages = useRoomStore((s) => s.messages);
  const userId = useRoomStore((s) => s.userId);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const close = () => setChatOpen(false);

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
    <Sheet title="Chat" onClose={close}>
      <div className="chat-list" ref={listRef} style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        {messages.length === 0 && <p className="empty">No messages yet. Say hi.</p>}
        {messages.map((m) =>
          m.kind === 'system' ? (
            <p key={m.id} className="sys">{m.text}</p>
          ) : (
            <div key={m.id} className={`msg${m.user_id === userId ? ' mine' : ''}`}>
              <div className="who">{m.user_id === userId ? 'You' : m.name}</div>
              <div className="bubble">{m.text}</div>
            </div>
          ),
        )}
      </div>
      <form className="chat-form" onSubmit={submit}>
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
        <button className="btn primary" type="submit" disabled={!text.trim() || sending} aria-label="Send">
          <SendIcon />
        </button>
      </form>
    </Sheet>
  );
}
