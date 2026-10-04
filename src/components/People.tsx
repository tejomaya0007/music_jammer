import { useMemo, useState } from 'react';
import { useRoomStore } from '../state/roomStore';
import { closeRoom, kick, transferHost } from '../state/session';
import { Avatar } from './avatar/Avatar';
import { Sheet } from './ui/Sheet';

const STACK_MAX = 4;

/** Header stack: online people first, up to four faces, then "+N". Tapping opens the member panel. */
export function MemberStack({ online, onlineCount, onOpen }: { online: string[]; onlineCount: number; onOpen: () => void }) {
  const allMembers = useRoomStore((s) => s.members);
  const hostId = useRoomStore((s) => s.room?.host_id ?? null);
  const members = useMemo(() => allMembers.filter((m) => !m.is_kicked), [allMembers]);
  const ordered = useMemo(
    () => [...members].sort((a, b) => Number(online.includes(b.user_id)) - Number(online.includes(a.user_id))),
    [members, online],
  );
  const shown = ordered.slice(0, STACK_MAX);
  const hidden = ordered.length - shown.length;

  return (
    <button type="button" className="people" onClick={onOpen} aria-label={`${onlineCount} online. Open the member list.`}>
      <span className="stack">
        {shown.map((m) => {
          const isOnline = online.includes(m.user_id);
          return (
            <span key={m.user_id} className={`person${isOnline ? '' : ' offline'}`} data-name={m.name}>
              <Avatar value={m.avatar} name={m.name} size={28} online={isOnline} host={m.user_id === hostId} />
            </span>
          );
        })}
        {hidden > 0 && <span className="more num">+{hidden}</span>}
      </span>
      <span className="count num">{onlineCount} online</span>
    </button>
  );
}

/** Member list: avatar, name, host label, online status; the host gets Make host, Remove, and Close room. */
export function MemberPanel({ onClose }: { onClose: () => void }) {
  const allMembers = useRoomStore((s) => s.members);
  const members = useMemo(() => allMembers.filter((m) => !m.is_kicked), [allMembers]);
  const online = useRoomStore((s) => s.online);
  const hostId = useRoomStore((s) => s.room?.host_id ?? null);
  const me = useRoomStore((s) => s.userId);
  const amHost = hostId !== null && hostId === me;
  const [confirmClose, setConfirmClose] = useState(false);

  return (
    <Sheet title={`People · ${online.length} online`} onClose={onClose}>
      <ul className="member-list">
        {members.map((m) => {
          const isOnline = online.includes(m.user_id);
          const isHost = m.user_id === hostId;
          const isMe = m.user_id === me;
          return (
            <li key={m.user_id} className="member-row">
              <Avatar value={m.avatar} name={m.name} size={44} online={isOnline} />
              <div className="who">
                <span className="who-name">{m.name}{isMe ? ' (you)' : ''}</span>
                <small>{isHost ? 'Host' : isOnline ? 'Online' : 'Offline'}</small>
              </div>
              {amHost && !isMe && (
                <div className="member-actions">
                  <button type="button" className="btn small" onClick={() => void transferHost(m.user_id, m.name)}>Make host</button>
                  <button type="button" className="btn danger small" aria-label={`Remove ${m.name}`} onClick={() => void kick(m.user_id, m.name)}>Remove</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {amHost && (
        <div className="member-footer">
          {confirmClose ? (
            <>
              <p className="footer-note">This ends the room for everyone, including people who are offline.</p>
              <div className="card-actions">
                <button type="button" className="btn" onClick={() => setConfirmClose(false)}>Keep it open</button>
                <button type="button" className="btn danger" onClick={() => void closeRoom()}>Close room</button>
              </div>
            </>
          ) : (
            <button type="button" className="btn danger block" onClick={() => setConfirmClose(true)}>Close room for everyone</button>
          )}
        </div>
      )}
    </Sheet>
  );
}
