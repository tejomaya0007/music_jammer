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
/** small drift (250 ms to 1.5 s) is fixed by a gentle speed change, not a seek: seeks force a re-buffer and stutter */
export const DRIFT_TOLERANCE_MS = 250;
/** a seek is used only for a gap this large, at most once per cooldown */
export const SEEK_GAP_MS = 1500;
export const DRIFT_COOLDOWN_MS = 4000;

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
  if (gap <= SEEK_GAP_MS) return null;
  if (input.nowMs - input.lastCorrectionMs < DRIFT_COOLDOWN_MS) return null;
  return input.expectedMs;
}

/** Playback speed that closes a small gap smoothly: 1.05 when behind, 0.95 when ahead, 1 when close. */
export function driftRate(playerPosMs: number, expectedMs: number): number {
  const diff = playerPosMs - expectedMs;
  if (Math.abs(diff) <= DRIFT_TOLERANCE_MS || Math.abs(diff) > SEEK_GAP_MS) return 1;
  return diff < 0 ? 1.05 : 0.95;
}

/** speed turns off only once the gap is back under this; between the two lines the current speed holds */
export const RATE_OFF_MS = 100;

/**
 * Speed with hysteresis. Judging only against the 250 ms line flips speed 1 -> 1.05 -> 1 on every
 * tick near that line, and each flip makes phones stutter or flicker. So: start a nudge past 250 ms,
 * stop it under 100 ms, keep whatever speed is set in between.
 */
export function nextDriftRate(prevRate: number, playerPosMs: number, expectedMs: number): number {
  const gap = Math.abs(playerPosMs - expectedMs);
  if (gap <= RATE_OFF_MS) return 1;
  if (gap <= DRIFT_TOLERANCE_MS) return prevRate;
  return driftRate(playerPosMs, expectedMs);
}
