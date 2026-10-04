import { describe, it, expect } from 'vitest';
import { parseVideoLinks, parseVideoId } from '../../src/lib/link';
import {
  expectedPositionMs, estimateClockOffset, reorderPosition, driftCorrectionTarget,
} from '../../src/lib/sync';

const ID = 'dQw4w9WgXcQ';

describe('parseVideoId (link parser)', () => {
  it.each([
    ['bare id', ID],
    ['youtu.be short link', `https://youtu.be/${ID}`],
    ['youtu.be with time', `https://youtu.be/${ID}?t=42`],
    ['youtu.be without scheme', `youtu.be/${ID}`],
    ['watch link', `https://www.youtube.com/watch?v=${ID}`],
    ['watch link, no www', `https://youtube.com/watch?v=${ID}`],
    ['watch link, mobile', `https://m.youtube.com/watch?v=${ID}&list=PLx&index=2`],
    ['watch with extra params first', `https://www.youtube.com/watch?feature=share&v=${ID}`],
    ['music link', `https://music.youtube.com/watch?v=${ID}`],
    ['shorts link', `https://www.youtube.com/shorts/${ID}`],
    ['embed link', `https://www.youtube.com/embed/${ID}`],
    ['live link', `https://www.youtube.com/live/${ID}`],
    ['old /v/ link', `https://www.youtube.com/v/${ID}`],
    ['nocookie embed', `https://www.youtube-nocookie.com/embed/${ID}`],
    ['surrounded by spaces', `   ${ID}  `],
  ])('accepts %s', (_name, input) => {
    expect(parseVideoId(input)).toBe(ID);
  });

  it.each([
    ['empty', ''],
    ['too short id', 'abc123'],
    ['too long id', 'dQw4w9WgXcQQ'],
    ['bad characters', 'dQw4w9Wg$cQ'],
    ['vimeo link', 'https://vimeo.com/12345678'],
    ['youtube home', 'https://www.youtube.com/'],
    ['youtube search', 'https://www.youtube.com/results?search_query=cats'],
    ['playlist only', 'https://www.youtube.com/playlist?list=PL1234'],
    ['youtu.be without id', 'https://youtu.be/'],
    ['short id in path', 'https://youtu.be/short'],
    ['random text', 'hello there friend'],
    ['spotify link', 'https://open.spotify.com/track/abc'],
    ['lookalike domain', `https://youtube.com.evil.example/watch?v=${ID}`],
  ])('rejects %s', (_name, input) => {
    expect(parseVideoId(input)).toBeNull();
  });
});

describe('parseVideoLinks (multiple links in one paste)', () => {
  it('splits on spaces, commas and new lines, keeping order and duplicates', () => {
    const input = [
      `https://youtu.be/${ID}`,
      `https://www.youtube.com/watch?v=jNQXAC9IVRw, https://youtu.be/M7lc1UVf-VE`,
      `aqz-KE-bpKQ\n${ID}`,
    ].join('\n');
    expect(parseVideoLinks(input)).toEqual({
      ids: [ID, 'jNQXAC9IVRw', 'M7lc1UVf-VE', 'aqz-KE-bpKQ', ID],
      invalid: [],
    });
  });

  it('collects junk tokens as invalid and keeps the good ones', () => {
    const r = parseVideoLinks(`${ID} not-a-link https://vimeo.com/1 jNQXAC9IVRw`);
    expect(r.ids).toEqual([ID, 'jNQXAC9IVRw']);
    expect(r.invalid).toEqual(['not-a-link', 'https://vimeo.com/1']);
  });

  it('returns nothing for blank input', () => {
    expect(parseVideoLinks('   \n  ,, ')).toEqual({ ids: [], invalid: [] });
  });
});

describe('expectedPositionMs', () => {
  const anchor = { anchorPosMs: 30_000, anchorTimeMs: 1_000_000, isPlaying: true };

  it('advances while playing', () => {
    expect(expectedPositionMs(anchor, 1_004_000)).toBe(34_000);
  });

  it('holds still while paused', () => {
    expect(expectedPositionMs({ ...anchor, isPlaying: false }, 1_004_000)).toBe(30_000);
  });

  it('never goes negative (clock skew before the anchor)', () => {
    expect(expectedPositionMs(anchor, 999_000)).toBe(30_000);
    expect(expectedPositionMs({ anchorPosMs: 0, anchorTimeMs: 5, isPlaying: false }, 0)).toBe(0);
  });
});

describe('estimateClockOffset', () => {
  it('uses the lowest round trip sample', () => {
    const offset = estimateClockOffset([
      { sentMs: 1000, receivedMs: 1400, serverMs: 5000 }, // rtt 400, noisy
      { sentMs: 2000, receivedMs: 2020, serverMs: 6012 }, // rtt 20, best
      { sentMs: 3000, receivedMs: 3300, serverMs: 7000 }, // rtt 300
    ]);
    // midpoint of best = 2010, server 6012 -> offset 4002
    expect(offset).toBe(4002);
  });

  it('gives serverNow = clientNow + offset, with the server reading taken at the client midpoint', () => {
    // request sent at client 100, answered at 120, so the server read happened near 110
    const offset = estimateClockOffset([{ sentMs: 100, receivedMs: 120, serverMs: 2110 }]);
    expect(offset).toBe(2000);
    expect(110 + offset).toBe(2110);
  });

  it('is zero when clocks agree and the midpoint matches the server time', () => {
    expect(estimateClockOffset([{ sentMs: 0, receivedMs: 100, serverMs: 50 }])).toBe(0);
  });

  it('needs at least one sample', () => {
    expect(() => estimateClockOffset([])).toThrow();
  });
});

describe('reorderPosition (midpoint)', () => {
  it('goes between two neighbours', () => {
    expect(reorderPosition(1, 2)).toBe(1.5);
    expect(reorderPosition(1, 1.5)).toBe(1.25);
  });

  it('goes to the top and bottom', () => {
    expect(reorderPosition(null, 1)).toBe(0);
    expect(reorderPosition(4, null)).toBe(5);
  });

  it('starts an empty list at 1', () => {
    expect(reorderPosition(null, null)).toBe(1);
  });
});

describe('driftCorrectionTarget', () => {
  const base = { playerPosMs: 10_000, expectedMs: 10_000, isPlaying: true, buffering: false, nowMs: 100_000, lastCorrectionMs: 0 };

  it('no correction when within 300 ms', () => {
    expect(driftCorrectionTarget({ ...base, playerPosMs: 10_299 })).toBeNull();
    expect(driftCorrectionTarget({ ...base, playerPosMs: 9_701 })).toBeNull();
  });

  it('corrects when drift is over 300 ms', () => {
    expect(driftCorrectionTarget({ ...base, playerPosMs: 10_301, expectedMs: 10_000 })).toBe(10_000);
  });

  it('skips while paused, buffering, or in cool-down', () => {
    expect(driftCorrectionTarget({ ...base, playerPosMs: 20_000, isPlaying: false })).toBeNull();
    expect(driftCorrectionTarget({ ...base, playerPosMs: 20_000, buffering: true })).toBeNull();
    expect(driftCorrectionTarget({ ...base, playerPosMs: 20_000, nowMs: 2000, lastCorrectionMs: 1000 })).toBeNull();
  });
});
