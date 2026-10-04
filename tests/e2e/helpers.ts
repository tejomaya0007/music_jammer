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
  await page.getByRole('button', { name: 'Start a jam' }).click();
  const chip = page.locator('.code-chip');
  await expect(chip).toBeVisible();
  const code = (await chip.textContent())?.trim() ?? '';
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  return code;
}

export async function joinByCode(page: Page, name: string, code: string) {
  await openApp(page);
  await page.getByLabel('Your name').fill(name);
  await page.getByLabel('Room code').fill(code);
  await page.getByRole('button', { name: 'Join', exact: true }).click();
  await expect(page.locator('.code-chip')).toHaveText(code);
}

/** Share link: opening it with no name stored opens home with the code filled. */
export async function joinByLink(page: Page, code: string, name?: string) {
  await openApp(page, `/?join=${code}`);
  if (name) {
    await page.getByLabel('Your name').fill(name);
    await page.getByRole('button', { name: 'Join', exact: true }).click();
  }
  await expect(page.locator('.code-chip')).toHaveText(code);
}

export async function tapToJoinMusic(page: Page) {
  const tap = page.getByRole('button', { name: 'Join in' });
  if (await tap.isVisible().catch(() => false)) await tap.click();
}

export async function addLinks(page: Page, text: string) {
  await page.getByLabel('YouTube links to add').fill(text);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
}

export async function queueTitles(page: Page): Promise<string[]> {
  return page.locator('.queue .row .t').allTextContents();
}

export async function members(page: Page): Promise<string[]> {
  return page.locator('.people .person').allTextContents();
}

/** Position of the shared playback as this client shows it, in seconds. */
export async function positionSec(page: Page): Promise<number> {
  const v = await page.locator('input.bar').inputValue();
  return Number(v);
}
