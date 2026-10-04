import { useState, type FormEvent } from 'react';
import { Wordmark } from '../components/brand/Wordmark';
import { AvatarPicker } from '../components/avatar/AvatarPicker';
import { formatAvatar, parseAvatar, randomAvatar, type Avatar } from '../lib/avatars';
import { saveProfile, readProfile } from '../lib/profile';

/** "Who's listening?": name and face. Shown once per device, or to edit the profile later. */
export function Onboarding({ onDone, onCancel }: { onDone: (name: string) => void; onCancel?: () => void }) {
  const existing = readProfile();
  const [name, setName] = useState(existing?.name ?? '');
  // a saved face is kept when editing; a first visit starts on a random one
  const [avatar, setAvatar] = useState<Avatar>(() => parseAvatar(existing?.avatar) ?? randomAvatar());
  const valid = name.trim().length > 0 && name.trim().length <= 30;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    saveProfile({ name: name.trim(), avatar: formatAvatar(avatar) });
    onDone(name.trim());
  };

  return (
    <main className="stage-page">
      <Wordmark />
      <form className="card onboard" onSubmit={submit} aria-labelledby="onboard-title">
        <h1 id="onboard-title" className="h-display">Who's listening?</h1>

        <label className="field">
          <span>Your name</span>
          <input
            className="input"
            value={name}
            maxLength={30}
            autoFocus
            autoComplete="nickname"
            placeholder="What friends will call you"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <div className="field">
          <span id="face-label">Pick a face</span>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>

        <div className="card-actions">
          {onCancel && (
            <button type="button" className="btn ghost" onClick={onCancel}>Back</button>
          )}
          <button type="submit" className="btn primary block" disabled={!valid}>Continue</button>
        </div>
      </form>
    </main>
  );
}
