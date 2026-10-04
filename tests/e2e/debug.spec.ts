import { test } from '@playwright/test';
import { resetBackend } from './helpers';

test('debug create', async ({ page, request }) => {
  await resetBackend(request);
  const logs: string[] = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) logs.push(`http ${r.status()} ${r.url()}`); });
  await page.goto('/');
  await page.getByLabel('Your name').fill('Ana');
  await page.getByRole('button', { name: 'Start a jam' }).click();
  await page.waitForTimeout(3000);
  console.log('HTML:', (await page.locator('#root').innerHTML()).slice(0, 1500));
  console.log('LOGS:\n' + logs.join('\n'));
});
