import { describe, it, expect } from 'vitest';
import { driftRate, driftCorrectionTarget, SEEK_GAP_MS, DRIFT_COOLDOWN_MS } from '../../src/lib/sync';

describe('gentle sync', () => {
  it('no speed change when close', () => {
    expect(driftRate(10_100, 10_000)).toBe(1);
  });
  it('speeds up a little when behind, slows when ahead', () => {
    expect(driftRate(9_500, 10_000)).toBe(1.05);
    expect(driftRate(10_600, 10_000)).toBe(0.95);
  });
  it('a big gap is left to a seek, not a speed change', () => {
    expect(driftRate(10_000 - SEEK_GAP_MS - 500, 10_000)).toBe(1);
  });
  it('seeks only for big gaps, and not again within the cooldown', () => {
    const base = { playerPosMs: 0, expectedMs: 10_000, isPlaying: true, buffering: false, nowMs: 100_000, lastCorrectionMs: 0 };
    expect(driftCorrectionTarget({ ...base, playerPosMs: 8_000 })).toBe(10_000);
    expect(driftCorrectionTarget({ ...base, playerPosMs: 9_000 })).toBeNull(); // 1 s: below the seek gap
    expect(driftCorrectionTarget({ ...base, playerPosMs: 8_000, lastCorrectionMs: 100_000 - DRIFT_COOLDOWN_MS / 2 })).toBeNull();
  });
});
