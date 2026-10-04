import { useEffect, useState } from 'react';
import { canPromptInstall, isIos, isStandalone, promptInstall, subscribeInstall } from '../lib/install';
import { toast } from '../state/roomStore';

/** Install the app: a button where the browser allows it, an instruction on iPhone, nothing once installed. */
export function InstallCard() {
  const [canInstall, setCanInstall] = useState(canPromptInstall());
  useEffect(() => subscribeInstall(() => setCanInstall(canPromptInstall())), []);

  if (isStandalone()) return null;

  if (canInstall) {
    return (
      <button
        type="button"
        className="install"
        onClick={async () => {
          const outcome = await promptInstall();
          if (outcome === 'accepted') toast('Jam Room installed. Open it from your home screen.');
        }}
      >
        Install the app
      </button>
    );
  }

  if (isIos()) {
    return <p className="install-hint">To install: tap Share, then Add to Home Screen.</p>;
  }

  return null;
}
