import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';

export const MOCK = 'http://127.0.0.1:8787/mock-api';

/** Start every test from an empty database. */
export async function resetBackend(request: APIRequestContext) {
  const r = await request.post(`${MOCK}/reset`);
  expect(r.ok()).toBeTruthy();
}

/** A friend's phone: its own browser context (own storage, own anonymous user). */
export async function newFriend(browser: Browser, name: string): Promise<{ ctx: BrowserContext; page: Page; name: string }> {
  const ctx = await browser.newContext({ ...(await deviceOptions()) });
  const page = await ctx.newPage();
  return { ctx, page, name };
}

async function deviceOptions() {
  return { viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 };
}

/** Open the app. A "Tap to join the music" overlay appears once a song plays; tap it. */
export async function openApp(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('.home, .room-ready, .app')).toBeVisible();
}

export async function createRoom(page: Page, name: string): Promise<string> {
  await openApp(page);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Create a room' }).click();
  const code = (await page.locator('.code-big').textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await page.getByRole('button', { name: 'Open room' }).click();
  await expect(page.locator('.code-line')).toHaveText(code);
  return code;
}

export async function joinByCode(page: Page, name: string, code: string) {
  await openApp(page);
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Join a room' }).click();
  await page.getByLabel('Room code').fill(code);
  await page.getByRole('button', { name: 'Join the room' }).click();
  await expect(page.locator('.code-line')).toHaveText(code.toUpperCase());
}

/** Share link: opens the join form with the code filled in; a stored name joins at once. */
export async function joinByLink(page: Page, code: string, name?: string) {
  await openApp(page, `/?join=${code}`);
  if (name) {
    await page.getByLabel('Your name').fill(name);
    await page.getByRole('button', { name: 'Join the room' }).click();
  }
  await expect(page.locator('.code-line')).toHaveText(code.toUpperCase());
}

/** Wait for the browser-autoplay gate to show, then tap it, the way a friend would. */
export async function tapToJoinMusic(page: Page) {
  const tap = page.getByRole('button', { name: 'Join in' });
  await expect(tap).toBeVisible();
  await tap.click();
  await expect(tap).toHaveCount(0);
}

export async function addLinks(page: Page, text: string) {
  await page.getByLabel('YouTube links to add').fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

export async function queueTitles(page: Page): Promise<string[]> {
  return page.locator('.queue .row .t').allTextContents();
}

export async function members(page: Page): Promise<string[]> {
  return page.locator('.person').evaluateAll((els) => els.map((e) => e.getAttribute('data-name') ?? ''));
}

/** Position of the shared playback as this client shows it, in seconds. */
export async function positionSec(page: Page): Promise<number> {
  const v = await page.locator('input.bar').inputValue();
  return Number(v);
}
