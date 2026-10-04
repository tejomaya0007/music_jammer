import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  resetBackend, createRoom, joinByCode, joinByLink, addLinks, queueTitles, positionSec, tapToJoinMusic,
} from './helpers';

/** Three friends, three separate browser contexts (no shared storage). */
interface Friend { ctx: BrowserContext; page: Page }
async function friend(browser: Browser): Promise<Friend> {
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6,
  });
  return { ctx, page: await ctx.newPage() };
}

const nowTitle = (p: Page) => p.locator('.now-title').textContent();
const isPlaying = async (p: Page) => (await p.locator('button.tbtn.big').getAttribute('aria-label')) === 'Pause';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test('three friends: create, join by link and by code, presence counts update', async ({ browser }) => {
  const a = await friend(browser);
  const b = await friend(browser);
  const c = await friend(browser);
  try {
    const code = await createRoom(a.page, 'Ana');
    await expect(a.page.locator('.count')).toHaveText('1 online');

    await joinByLink(b.page, code, 'Bo');
    await expect(a.page.locator('.count')).toHaveText('2 online');

    await joinByCode(c.page, 'Cy', code.toLowerCase());
    await expect(a.page.locator('.count')).toHaveText('3 online');
    await expect(b.page.locator('.count')).toHaveText('3 online');
    await expect(c.page.locator('.count')).toHaveText('3 online');

    // a friend closing the tab goes offline, the room keeps running
    await c.ctx.close();
    await expect(a.page.locator('.count')).toHaveText('2 online');
    await expect(b.page.locator('.count')).toHaveText('2 online');
  } finally {
    await a.ctx.close();
    await b.ctx.close();
  }
});

test('three pasted links at once, all friends see the same queue', async ({ browser }) => {
  const a = await friend(browser);
  const b = await friend(browser);
  const c = await friend(browser);
  try {
    const code = await createRoom(a.page, 'Ana');
    await joinByLink(b.page, code, 'Bo');
    await joinByLink(c.page, code, 'Cy');
    await addLinks(a.page, [
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      'https://music.youtube.com/watch?v=M7lc1UVf-VE',
    ].join('\n'));
    const expected = ['Fake song dQw4w9WgXcQ', 'Fake song jNQXAC9IVRw', 'Fake song M7lc1UVf-VE'];
    for (const p of [a.page, b.page, c.page]) {
      await expect.poll(() => queueTitles(p)).toEqual(expected);
    }
    // a bad link adds nothing and shows an error
    await addLinks(b.page, 'https://vimeo.com/123');
    await expect(b.page.locator('.toast.error')).toContainText('Not a YouTube link');
    await expect.poll(() => queueTitles(a.page)).toHaveLength(3);
  } finally {
    for (const f of [a, b, c]) await f.ctx.close();
  }
});

test('synced transport: play, pause, seek, next, previous, and the drag reorder shows for everyone', async ({ browser }) => {
  const a = await friend(browser);
  const b = await friend(browser);
  const c = await friend(browser);
  try {
    const code = await createRoom(a.page, 'Ana');
    await joinByLink(b.page, code, 'Bo');
    await joinByLink(c.page, code, 'Cy');
    await addLinks(a.page, 'dQw4w9WgXcQ jNQXAC9IVRw M7lc1UVf-VE');
    await expect.poll(() => queueTitles(c.page)).toHaveLength(3);

    // everyone taps "Tap to join the music" (browser autoplay rule)
    for (const f of [a, b, c]) await expect(f.page.getByRole('button', { name: 'Join in' })).toBeVisible();
    for (const f of [a, b, c]) await tapToJoinMusic(f.page);

    // all three are on the first song, playing, and within a second of each other
    const first = 'Fake song dQw4w9WgXcQ';
    for (const f of [a, b, c]) {
      await expect.poll(() => nowTitle(f.page)).toBe(first);
      await expect.poll(() => isPlaying(f.page)).toBe(true);
    }
    await expect.poll(async () => Math.abs((await positionSec(a.page)) - (await positionSec(c.page)))).toBeLessThan(1.5);

    // pause from a friend's phone; once paused the position must stop moving
    await b.page.locator('button.tbtn.big').click();
    for (const f of [a, b, c]) await expect.poll(() => isPlaying(f.page)).toBe(false);
    await a.page.waitForTimeout(400); // let the seek bar catch up with the store (it refreshes every 250 ms)
    const paused = await positionSec(a.page);
    await a.page.waitForTimeout(1200);
    expect(Math.abs((await positionSec(a.page)) - paused)).toBeLessThan(0.3);

    // resume
    await c.page.locator('button.tbtn.big').click();
    for (const f of [a, b, c]) await expect.poll(() => isPlaying(f.page)).toBe(true);

    // seek with the keyboard on the seek bar: 100 steps of 0.1 s = about 10 s in
    const bar = b.page.locator('input.bar');
    await bar.focus();
    for (let i = 0; i < 100; i++) await b.page.keyboard.press('ArrowRight');
    await expect.poll(() => positionSec(a.page), { timeout: 15_000 }).toBeGreaterThan(9.5);
    // everyone lands on the same moment (playback keeps moving, so compare friends, not a fixed number)
    await expect.poll(async () => Math.abs((await positionSec(a.page)) - (await positionSec(c.page))), { timeout: 15_000 }).toBeLessThan(1.5);
    await expect.poll(async () => Math.abs((await positionSec(a.page)) - (await positionSec(b.page))), { timeout: 15_000 }).toBeLessThan(1.5);

    // next, then previous, from the host
    await a.page.getByRole('button', { name: 'Next' }).click();
    for (const f of [a, b, c]) await expect.poll(() => nowTitle(f.page)).toBe('Fake song jNQXAC9IVRw');
    await c.page.getByRole('button', { name: 'Previous' }).click();
    for (const f of [a, b, c]) await expect.poll(() => nowTitle(f.page)).toBe(first);

    // drag the third song to the top, everyone sees it
    const grip = a.page.locator('li.row').nth(2).locator('button.grip');
    const target = a.page.locator('li.row').nth(0);
    await grip.scrollIntoViewIfNeeded(); // the third row starts below the fold on a phone
    const g = await grip.boundingBox();
    const t = await target.boundingBox();
    if (!g || !t) throw new Error('queue rows not laid out');
    await a.page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await a.page.mouse.down();
    await a.page.mouse.move(g.x + g.width / 2, g.y + g.height / 2 - 12, { steps: 5 });
    await a.page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 20 });
    await a.page.waitForTimeout(150);
    await a.page.mouse.up();
    const reordered = ['Fake song M7lc1UVf-VE', 'Fake song dQw4w9WgXcQ', 'Fake song jNQXAC9IVRw'];
    for (const f of [a, b, c]) await expect.poll(() => queueTitles(f.page)).toEqual(reordered);
    // the playing song was not interrupted by the drag
    await expect.poll(() => nowTitle(b.page)).toBe(first);
  } finally {
    for (const f of [a, b, c]) await f.ctx.close();
  }
});

test('chat reaches everyone, unread badge counts while the drawer is closed', async ({ browser }) => {
  const a = await friend(browser);
  const b = await friend(browser);
  const c = await friend(browser);
  try {
    const code = await createRoom(a.page, 'Ana');
    await joinByLink(b.page, code, 'Bo');
    await joinByLink(c.page, code, 'Cy');

    await a.page.getByRole('button', { name: 'Chat' }).click();
    await a.page.getByLabel('Message').fill('hello friends');
    await a.page.getByRole('button', { name: 'Send' }).click();
    await expect(a.page.locator('.msg .bubble', { hasText: 'hello friends' })).toBeVisible();

    // b and c have the drawer closed: unread badge shows 1
    for (const f of [b, c]) {
      await expect(f.page.locator('.chat-bar .badge')).toHaveText('1');
    }
    await b.page.getByRole('button', { name: /Chat/ }).click();
    await expect(b.page.locator('.msg .bubble', { hasText: 'hello friends' })).toBeVisible();
    await expect(b.page.locator('.sys', { hasText: 'Cy joined' })).toBeVisible();
    await b.page.getByRole('button', { name: 'Close' }).click();
    await expect(b.page.locator('.chat-bar .badge')).toHaveCount(0);
  } finally {
    for (const f of [a, b, c]) await f.ctx.close();
  }
});

test('host leaves and the music keeps playing under a new host, then host kicks and closes', async ({ browser }) => {
  const a = await friend(browser);
  const b = await friend(browser);
  const c = await friend(browser);
  try {
    const code = await createRoom(a.page, 'Ana');
    await joinByLink(b.page, code, 'Bo');
    await joinByLink(c.page, code, 'Cy');
    await addLinks(a.page, 'dQw4w9WgXcQ jNQXAC9IVRw');
    await expect.poll(() => queueTitles(c.page)).toHaveLength(2);
    await tapToJoinMusic(b.page);
    await tapToJoinMusic(c.page);
    await expect.poll(() => isPlaying(b.page)).toBe(true);
    // host (Ana) taps Leave
    await a.page.getByRole('button', { name: 'Leave' }).click();
    await expect(a.page.locator('.home')).toBeVisible();
    // the longest-present member, Bo, becomes host; music still playing
    await expect(b.page.locator('.toast', { hasText: "You're now the host" })).toBeVisible();
    await expect(b.page.locator('.person[data-name="Bo"]').locator('.crown')).toBeVisible();
    await expect.poll(() => isPlaying(c.page)).toBe(true);
    await expect.poll(() => nowTitle(c.page)).toBe('Fake song dQw4w9WgXcQ');
    await expect(b.page.locator('.count')).toHaveText('2 online');
    // new host kicks Cy
    await b.page.locator('.people').click();
    await b.page.getByRole('button', { name: 'Remove Cy' }).click();
    await expect(c.page.locator('.toast.error', { hasText: 'you were removed' })).toBeVisible();
    await expect(c.page.locator('.home')).toBeVisible();
    // a kicked person cannot get back in with the same code
    await c.page.getByLabel('Your name').fill('Cy');
    await c.page.getByRole('button', { name: 'Join a room' }).click();
    await c.page.getByLabel('Room code').fill(code);
    await c.page.getByRole('button', { name: 'Join the room' }).click();
    await expect(c.page.locator('.toast.error', { hasText: 'You were removed from this room' })).toBeVisible();
    await expect(c.page.locator('.home')).toBeVisible();
    // host closes the room for everyone (the people sheet is still open from the kick)
    await b.page.getByRole('button', { name: 'Close room for everyone' }).click();
    await b.page.getByRole('button', { name: 'Close room', exact: true }).click();
    await expect(b.page.locator('.home')).toBeVisible();
  } finally {
    for (const f of [a, b, c]) await f.ctx.close();
  }
});

test('reload auto-rejoins the same room', async ({ browser }) => {
  const a = await friend(browser);
  try {
    const code = await createRoom(a.page, 'Ana');
    await addLinks(a.page, 'dQw4w9WgXcQ');
    await expect.poll(() => queueTitles(a.page)).toHaveLength(1);
    await a.page.reload();
    await expect(a.page.locator('.code-line')).toHaveText(code);
    await expect.poll(() => queueTitles(a.page)).toHaveLength(1);
    await expect(a.page.locator('.count')).toHaveText('1 online');
  } finally {
    await a.ctx.close();
  }
});

test('a room with one person works alone', async ({ browser }) => {
  const a = await friend(browser);
  try {
    await createRoom(a.page, 'Solo');
    await addLinks(a.page, 'dQw4w9WgXcQ jNQXAC9IVRw');
    await expect.poll(() => queueTitles(a.page)).toHaveLength(2);
    await tapToJoinMusic(a.page);
    await expect.poll(() => isPlaying(a.page)).toBe(true);
    await a.page.getByRole('button', { name: 'Next' }).click();
    await expect.poll(() => nowTitle(a.page)).toBe('Fake song jNQXAC9IVRw');
    await a.page.getByRole('button', { name: 'Next' }).click();
    await expect.poll(() => isPlaying(a.page)).toBe(false);
    await a.page.getByRole('button', { name: 'Chat' }).click();
    await a.page.getByLabel('Message').fill('talking to myself');
    await a.page.getByRole('button', { name: 'Send' }).click();
    await expect(a.page.locator('.msg .bubble', { hasText: 'talking to myself' })).toBeVisible();
  } finally {
    await a.ctx.close();
  }
});

test('host disconnects without leaving: after about 40 s the next person takes over', async ({ browser }) => {
  test.setTimeout(150_000);
  const a = await friend(browser);
  const b = await friend(browser);
  try {
    const code = await createRoom(a.page, 'Ana');
    await joinByLink(b.page, code, 'Bo');
    await addLinks(a.page, 'dQw4w9WgXcQ');
    await expect.poll(() => queueTitles(b.page)).toHaveLength(1);
    await a.ctx.close(); // tab closed, no leave

    await expect(b.page.locator('.count')).toHaveText('1 online');
    await expect(b.page.locator('.person[data-name="Ana"]').locator('.crown')).toHaveCount(1);
    await expect(b.page.locator('.person[data-name="Bo"]').locator('.crown')).toHaveCount(1, { timeout: 90_000 });
    await expect(b.page.locator('.toast', { hasText: "You're now the host" })).toBeVisible({ timeout: 10_000 });
  } finally {
    await b.ctx.close();
  }
});

test('a friend who joins mid-song lands on the same moment as the room', async ({ browser }) => {
  test.setTimeout(120_000);
  const a = await friend(browser);
  const b = await friend(browser);
  const c = await friend(browser);
  try {
    const code = await createRoom(a.page, 'Ana');
    await joinByLink(b.page, code, 'Bo');
    await addLinks(a.page, 'dQw4w9WgXcQ');
    await tapToJoinMusic(a.page);
    await tapToJoinMusic(b.page);
    await expect.poll(() => isPlaying(b.page)).toBe(true);
    await a.page.waitForTimeout(6000);

    await joinByLink(c.page, code, 'Cy');
    await tapToJoinMusic(c.page);
    await expect.poll(() => isPlaying(c.page)).toBe(true);
    // all three within about a second of each other, and playing well past the start
    await expect.poll(() => positionSec(c.page)).toBeGreaterThan(5);
    await expect.poll(async () => Math.abs((await positionSec(a.page)) - (await positionSec(c.page)))).toBeLessThan(1.5);
    await expect.poll(async () => Math.abs((await positionSec(b.page)) - (await positionSec(c.page)))).toBeLessThan(1.5);
  } finally {
    for (const f of [a, b, c]) await f.ctx.close();
  }
});
