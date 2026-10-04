import { PLAYER } from '../config';
import type { Player } from './types';
import { createFakePlayer } from './fake';
import { createYouTubePlayer } from './youtube';

export type { Player, PlayerEvent } from './types';

/** VITE_PLAYER=fake for tests and the mock backend, youtube otherwise. */
export async function createPlayer(mount: HTMLElement): Promise<Player> {
  if (PLAYER === 'fake') {
    // the fake has no DOM; keep the mount so the layout matches the real player
    const host = document.createElement('div');
    host.setAttribute('data-fake-player', '');
    mount.appendChild(host);
    return createFakePlayer();
  }
  return createYouTubePlayer(mount);
}
