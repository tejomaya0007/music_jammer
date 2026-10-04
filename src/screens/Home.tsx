import { Wordmark } from '../components/brand/Wordmark';
import { Avatar } from '../components/avatar/Avatar';
import { createRoom } from '../state/session';
import { toast } from '../state/roomStore';
import { readProfile } from '../lib/profile';

/** Home: profile chip, two large cards (start a room, join with a code). */
export function Home({ onJoin, onEditProfile }: { onJoin: () => void; onEditProfile: () => void }) {
  const profile = readProfile();

  const start = () => {
    if (!profile) return toast('Add your name to start', 'error');
    void createRoom(profile.name);
  };

  return (
    <main className="stage-page">
      <Wordmark />
      <section className="card home-card" aria-labelledby="home-title">
        <div className="profile-chip">
          <Avatar value={profile?.avatar} name={profile?.name ?? '?'} size={32} />
          <span className="profile-name">{profile?.name}</span>
          <button type="button" className="link-btn" onClick={onEditProfile}>Edit</button>
        </div>

        <div className="home-copy">
          <h1 id="home-title" className="h-display">Listen together.</h1>
          <p className="lede">Same song, same second, from wherever your friends are.</p>
        </div>

        <div className="home-cards">
          <button type="button" className="action-card primary" onClick={start}>
            <span className="action-title">Start a room</span>
            <span className="action-sub">Get a code to share</span>
          </button>
          <button type="button" className="action-card" onClick={onJoin}>
            <span className="action-title">Join with a code</span>
            <span className="action-sub">Got a code or link?</span>
          </button>
        </div>
      </section>
    </main>
  );
}
