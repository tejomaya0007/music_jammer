import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const MOCK = 'http://127.0.0.1:8787/mock-api';

/** Start every test from an empty database. */
export async function resetBackend(request: APIRequestContext) {
  const r = await request.post(`${MOCK}/reset`);
  expect(r.ok()).toBeTruthy();
}

/** Open the app. A first visit shows onboarding. */
export async function openApp(page: Page, path = '/') {
  await page.goto(path);
  await expect(page.locator('.stage-page')).toBeVisible();
}

/** Onboarding: name and face, then Continue (the friend's profile is kept on this device). */
export async function onboard(page: Page, name: string) {
  await page.getByLabel('Your name').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
}

export async function createRoom(page: Page, name: string): Promise<string> {
  await openApp(page);
  await onboard(page, name);
  await page.getByRole('button', { name: 'Start a room' }).click();
  const code = ((await page.locator('.ticket-code').textContent()) ?? '').replace(/\s/g, '');
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await page.getByRole('button', { name: 'Enter room' }).click();
  await expect(page.locator('.code-line')).toHaveText(code);
  return code;
}

/** Join by typing the six characters into the code boxes. */
export async function joinByCode(page: Page, name: string, code: string) {
  await openApp(page);
  await onboard(page, name);
  await page.getByRole('button', { name: 'Join with a code' }).click();
  const chars = code.toUpperCase().split('');
  for (let i = 0; i < 6; i++) await page.getByLabel(`Character ${i + 1} of 6`).fill(chars[i]);
  await page.getByRole('button', { name: 'Join room' }).click();
  await expect(page.locator('.code-line')).toHaveText(code.toUpperCase());
}

/**
 * Share link: a first visit with no profile shows onboarding, then joins automatically.
 * Pass a name to complete onboarding; the room is entered when the join succeeds.
 */
export async function joinByLink(page: Page, code: string, name?: string) {
  await openApp(page, `/?join=${code}`);
  if (name) await onboard(page, name);
  await expect(page.locator('.code-line')).toHaveText(code.toUpperCase());
}

/** Wait for the browser-autoplay gate to show, then tap it, the way a friend would. */
export async function tapToJoinMusic(page: Page) {
  const tap = page.getByRole('button', { name: 'Join the music', exact: true });
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
  const v = await page.locator('input[aria-label="Seek"]').inputValue();
  return Number(v);
}

/** Play or pause from the device's transport (whichever state is showing). */
export async function togglePlayPause(page: Page) {
  const btn = page.getByRole('button', { name: /^(Play|Pause)$/ }).first();
  await btn.click();
}

/** True while the room's playback is running (the transport shows Pause). */
export async function isPlaying(page: Page): Promise<boolean> {
  return (await page.getByRole('button', { name: 'Pause', exact: true }).count()) > 0;
}
