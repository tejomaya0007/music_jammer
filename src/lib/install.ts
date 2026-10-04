/**
 * "Install the app": Chrome and Brave on Android and desktop offer an install prompt
 * (beforeinstallprompt). iPhone has no prompt, so it gets a short instruction instead.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());

/** Call once at startup, before the first render. */
export function initInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep the prompt for our own button
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function subscribeInstall(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function canPromptInstall(): boolean {
  return deferred !== null;
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Shows the browser's install dialog. Returns the person's choice, or 'none' when no prompt is available. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'none'> {
  if (!deferred) return 'none';
  const ev = deferred;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  deferred = null;
  notify();
  return outcome;
}
