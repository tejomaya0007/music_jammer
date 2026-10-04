import { PLAYER } from '../config';
import type { Player } from './types';
import { createFakePlayer } from './fake';
import { createYouTubePlayer } from './youtube';

export type { Player, PlayerEvent } from './types';

/** VITE_PLAYER=fake for tests and the mock backend, youtube otherwise. */
export async function createPlayer(mount: HTMLElement): Promise<Player> {
  if (PLAYER === 'fake') {
    // the fake has no video; a plain node stands in for the iframe, with state on data-* attributes
    const host = document.createElement('div');
    host.setAttribute('data-fake-player', '');
    mount.appendChild(host);
    return createFakePlayer(host);
  }
  return createYouTubePlayer(mount);
}
