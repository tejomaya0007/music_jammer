import { useEffect, useState } from 'react';
import { useRoomStore } from './state/roomStore';
import { boot, joinByCode } from './state/session';
import { readProfile } from './lib/profile';
import { Onboarding } from './screens/Onboarding';
import { Home } from './screens/Home';
import { JoinCode } from './screens/JoinCode';
import { RoomReady } from './screens/RoomReady';
import { Room } from './components/Room';
import { Toasts } from './components/Toasts';

/** `?join=CODE` from a shared link. Read once, then removed from the address bar. */
function readInviteCode(): string | null {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('join');
  if (code) {
    url.searchParams.delete('join');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  return code ? code.trim().toUpperCase().slice(0, 6) : null;
}

// read once per page load, before StrictMode's second mount can strip it from the URL
const initialInvite = readInviteCode();

export function App() {
  const booted = useRoomStore((s) => s.booted);
  const inRoom = useRoomStore((s) => s.roomId !== null);
  const pending = useRoomStore((s) => s.pendingRoom);
  const invite = useRoomStore((s) => s.invite);
  const [editing, setEditing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [, setProfileRev] = useState(0);
  const profile = readProfile();

  useEffect(() => {
    void boot(initialInvite);
  }, []);

  if (!booted) {
    return <main className="stage-page"><p className="lede">Tuning in…</p></main>;
  }

  let screen;
  if (inRoom) {
    screen = <Room />;
  } else if (pending) {
    screen = <RoomReady code={pending.code} />;
  } else if (!profile || editing) {
    screen = (
      <Onboarding
        onCancel={editing ? () => setEditing(false) : undefined}
        onDone={(name) => {
          setProfileRev((n) => n + 1);
          setEditing(false);
          // a shared link with no profile: onboarding first, then join automatically
          if (invite) void joinByCode(invite, name);
        }}
      />
    );
  } else if (joining || invite) {
    screen = <JoinCode initial={invite ?? ''} onBack={() => setJoining(false)} />;
  } else {
    screen = <Home onJoin={() => setJoining(true)} onEditProfile={() => setEditing(true)} />;
  }

  return (
    <>
      {screen}
      <Toasts />
    </>
  );
}
