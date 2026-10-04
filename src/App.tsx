import { useEffect } from 'react';
import { useRoomStore } from './state/roomStore';
import { boot } from './state/session';
import { Home } from './components/Home';
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

const inviteCode = readInviteCode();

export function App() {
  const booted = useRoomStore((s) => s.booted);
  const inRoom = useRoomStore((s) => s.roomId !== null);

  useEffect(() => {
    void boot(inviteCode);
  }, []);

  let screen;
  if (!booted) screen = <main className="home"><p className="lede">Starting…</p></main>;
  else if (inRoom) screen = <Room />;
  else screen = <Home inviteCode={inviteCode} />;

  return (
    <>
      {screen}
      <Toasts />
    </>
  );
}
