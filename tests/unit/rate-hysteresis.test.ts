import { describe, it, expect } from 'vitest';
import { nextDriftRate } from '../../src/lib/sync';

describe('nextDriftRate (hysteresis, no speed flip-flop)', () => {
  it('turns a nudge on only past 250 ms', () => {
    expect(nextDriftRate(1, 9_700, 10_000)).toBe(1.05); // 300 ms behind: speed up
    expect(nextDriftRate(1, 10_300, 10_000)).toBe(0.95); // 300 ms ahead: slow down
    expect(nextDriftRate(1, 10_200, 10_000)).toBe(1); // 200 ms: inside the band, stays at 1
  });

  it('holds the current speed inside the 100 to 250 ms band', () => {
    expect(nextDriftRate(1.05, 10_200, 10_000)).toBe(1.05);
    expect(nextDriftRate(0.95, 9_800, 10_000)).toBe(0.95);
    expect(nextDriftRate(1.05, 10_150, 10_000)).toBe(1.05);
  });

  it('returns to 1 once the gap is under 100 ms', () => {
    expect(nextDriftRate(1.05, 10_090, 10_000)).toBe(1);
    expect(nextDriftRate(0.95, 10_000, 10_000)).toBe(1);
  });

  it('does not nudge for a big gap (a seek handles that)', () => {
    expect(nextDriftRate(1.05, 12_000, 10_000)).toBe(1);
  });

  it('does not flip on a gap that wobbles around 250 ms', () => {
    let rate = 1;
    const seen = new Set<number>();
    // player behind by 300, 240, 260, 230, 270, 240 ms: a single-line check would flip on every step
    for (const gap of [300, 240, 260, 230, 270, 240]) {
      rate = nextDriftRate(rate, 10_000 - gap, 10_000);
      seen.add(rate);
    }
    expect(seen).toEqual(new Set([1.05]));
  });
});
