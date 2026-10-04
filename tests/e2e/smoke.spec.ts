import { test, expect } from '@playwright/test';
import { resetBackend, createRoom, joinByLink, addLinks, queueTitles, members } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetBackend(request);
});

test('host creates a room, a friend joins by link, both see two online', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const friendCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const friend = await friendCtx.newPage();
  const code = await createRoom(host, 'Ana');
  await expect(host.locator('.count')).toHaveText('1 online');

  await joinByLink(friend, code, 'Bo');
  await expect(host.locator('.count')).toHaveText('2 online');
  await expect(friend.locator('.count')).toHaveText('2 online');
  expect(await members(host)).toEqual(expect.arrayContaining([expect.stringContaining('Ana'), expect.stringContaining('Bo')]));
  await hostCtx.close();
  await friendCtx.close();
});

test('pasted link lands in everyone queue', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const friendCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const friend = await friendCtx.newPage();
  const code = await createRoom(host, 'Ana');
  await joinByLink(friend, code, 'Bo');
  await addLinks(host, 'https://youtu.be/dQw4w9WgXcQ');
  await expect.poll(() => queueTitles(friend)).toEqual(['Fake song dQw4w9WgXcQ']);
  await expect.poll(() => queueTitles(host)).toEqual(['Fake song dQw4w9WgXcQ']);
  await hostCtx.close();
  await friendCtx.close();
});
