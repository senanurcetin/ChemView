import { expect, test, type APIRequestContext } from '@playwright/test';

const command = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post('/api/command', { data: body });

test.beforeEach(async ({ request }) => {
  // The simulation is shared server state: put the plant in a known idle state first.
  await command(request, { type: 'estop' });
  await command(request, { type: 'set_valve', open: false });
  await command(request, { type: 'set_mode', manual: false });
});

test('dashboard connects to the gateway without page errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  await expect(page.locator('footer')).toContainText('STATE: IDLE');
  expect(errors).toEqual([]);
});

test('starting the mixer spins the rotor up', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();

  await page.getByRole('button', { name: /start/i }).first().click();
  await expect(page.locator('footer')).toContainText('STATE: MIXING', { timeout: 10_000 });
  await expect(page.locator('footer')).toContainText('INTERLOCK: ACTIVE');
});

test('the discharge interlock rejects Start with a visible toast', async ({ page, request }) => {
  await command(request, { type: 'set_valve', open: true });

  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  // The button may be styled as locked; force the click to prove the server enforces it too.
  await page.getByRole('button', { name: /start/i }).first().click({ force: true });

  // Exact match: the same text is also mirrored into an aria-live region for screen readers.
  await expect(page.getByText('Interlock Active', { exact: true })).toBeVisible();
  await expect(page.locator('footer')).toContainText('STATE: IDLE');
});

test('E-STOP halts a running mixer immediately', async ({ page, request }) => {
  await command(request, { type: 'start' });

  await page.goto('/');
  await expect(page.locator('footer')).toContainText('STATE: MIXING', { timeout: 10_000 });

  await page.getByRole('button', { name: /e-stop/i }).click();
  await expect(page.locator('footer')).toContainText('STATE: IDLE', { timeout: 5_000 });
  await expect(page.locator('footer')).toContainText('LOCK: READY');
});

test('trend history survives a page reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  // Let the server persist a few 5 s samples, then reload.
  await page.waitForTimeout(12_000);
  await page.reload();
  await expect(page.getByText('Gateway Active')).toBeVisible();

  const segments = await page
    .locator('.recharts-line-curve')
    .first()
    .evaluate((el) => {
      return (el.getAttribute('d')?.match(/[CL]/g) ?? []).length;
    });
  expect(segments).toBeGreaterThanOrEqual(2);
});
