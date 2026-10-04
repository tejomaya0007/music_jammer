import { useMemo, useState } from 'react';
import { useRoomStore } from '../state/roomStore';
import { closeRoom, kick, transferHost } from '../state/session';
import { CloseIcon, CrownIcon } from './icons';
import { Avatar, Sheet } from './parts';

/** Members, presence, and (for the host) the admin actions. */
export function PeopleSheet({ onClose }: { onClose: () => void }) {
  const allMembers = useRoomStore((s) => s.members);
  const members = useMemo(() => allMembers.filter((m) => !m.is_kicked), [allMembers]);
  const online = useRoomStore((s) => s.online);
  const hostId = useRoomStore((s) => s.room?.host_id ?? null);
  const me = useRoomStore((s) => s.userId);
  const amHost = hostId !== null && hostId === me;
  const [confirmClose, setConfirmClose] = useState(false);

  return (
    <Sheet title={`People · ${online.length} online`} onClose={onClose}>
      <ul className="people-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {members.map((m) => {
          const isOnline = online.includes(m.user_id);
          const isHost = m.user_id === hostId;
          const isMe = m.user_id === me;
          return (
            <li key={m.user_id} className="member-row">
              <Avatar name={m.name} id={m.user_id} online={isOnline} />
              <div className="who">
                <span>{m.name}{isMe ? ' (you)' : ''} {isHost && <CrownIcon className="crown" style={{ width: 14, height: 14, verticalAlign: '-2px' }} />}</span>
                <small>{isHost ? 'Host' : isOnline ? 'Online' : 'Offline'}</small>
              </div>
              {amHost && !isMe && (
                <>
                  <button className="btn" onClick={() => void transferHost(m.user_id, m.name)}>Make host</button>
                  <button className="icon-btn" aria-label={`Remove ${m.name}`} onClick={() => void kick(m.user_id, m.name)}>
                    <CloseIcon />
                  </button>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {amHost && (
        <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
          {confirmClose ? (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 'var(--t-sm)' }}>
                This ends the room for everyone, including people who are offline. Its queue and chat stop working.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button className="btn" onClick={() => setConfirmClose(false)}>Keep it open</button>
                <button className="btn danger" onClick={() => void closeRoom()}>Close room</button>
              </div>
            </>
          ) : (
            <button className="btn danger block" onClick={() => setConfirmClose(true)}>Close room for everyone</button>
          )}
        </div>
      )}
    </Sheet>
  );
}
