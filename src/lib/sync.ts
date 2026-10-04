/**
 * Pure sync math. The rooms row is the single source of truth:
 *   anchor_pos_ms = playback position when the state last changed
 *   anchor_time   = database time (ms since epoch) when it changed
 * All times here are server-clock milliseconds unless the name says client.
 */

export interface PlaybackAnchor {
  anchorPosMs: number;
  anchorTimeMs: number;
  isPlaying: boolean;
}

/** Where playback should be right now, on the server clock. */
export function expectedPositionMs(a: PlaybackAnchor, serverNowMs: number): number {
  const elapsed = a.isPlaying ? Math.max(0, serverNowMs - a.anchorTimeMs) : 0;
  return Math.max(0, a.anchorPosMs + elapsed);
}

export interface ClockSample {
  /** client time just before the request was sent */
  sentMs: number;
  /** client time when the response arrived */
  receivedMs: number;
  /** server epoch ms returned by get_server_time() */
  serverMs: number;
}

/**
 * Clock offset (server minus client) from several round trips.
 * Uses the sample with the smallest round trip, since that one has the least
 * network delay to hide. offset = server - client, so serverNow = clientNow + offset.
 */
export function estimateClockOffset(samples: ClockSample[]): number {
  if (samples.length === 0) throw new Error('need at least one clock sample');
  let best = samples[0];
  for (const s of samples) {
    if (s.receivedMs - s.sentMs < best.receivedMs - best.sentMs) best = s;
  }
  const clientMid = (best.sentMs + best.receivedMs) / 2;
  return best.serverMs - clientMid;
}

/**
 * Midpoint between two neighbours in the queue, for drag reorder.
 * Null neighbour = top or bottom of the list.
 */
export function reorderPosition(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return 1;
  if (prev === null) return (next as number) - 1;
  if (next === null) return prev + 1;
  return (prev + next) / 2;
}

/**
 * Drift loop decision. Correct only while playing, not buffering, and not
 * within the 2.5 s cool-down after the last correction.
 */
export const DRIFT_TOLERANCE_MS = 250;
export const DRIFT_COOLDOWN_MS = 1000;
/** while buffering, small drift waits; a gap this large is corrected anyway (a stuck buffer must not hide drift) */
export const BUFFER_OVERRIDE_MS = 1500;

export function driftCorrectionTarget(input: {
  playerPosMs: number;
  expectedMs: number;
  isPlaying: boolean;
  buffering: boolean;
  nowMs: number;
  lastCorrectionMs: number;
}): number | null {
  if (!input.isPlaying) return null;
  const gap = Math.abs(input.playerPosMs - input.expectedMs);
  if (input.buffering && gap < BUFFER_OVERRIDE_MS) return null;
  if (input.nowMs - input.lastCorrectionMs < DRIFT_COOLDOWN_MS) return null;
  if (gap <= DRIFT_TOLERANCE_MS) return null;
  return input.expectedMs;
}
