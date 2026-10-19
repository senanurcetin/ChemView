import { expect, test, type APIRequestContext } from '@playwright/test';

const command = (request: APIRequestContext, body: Record<string, unknown>) =>
  request.post('/api/command', { data: body });

test.beforeEach(async ({ request }) => {
  // The simulation is shared server state: put the plant in a known idle state first.
  await command(request, { type: 'estop' });
  // Reset is deliberate: E-STOP now remains latched across commands and ticks.
  await command(request, { type: 'reset_estop' });
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

test('dashboard displays the current simulation session and data age', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  await expect(page.getByTestId('telemetry-run-id')).toContainText(/SESSION: [0-9a-f]{8}/i);
  await expect(page.getByTestId('telemetry-age')).toContainText(/LAST DATA: \d+s AGO/i);
});

test('stalled SSE data is marked stale even when the connection stays open', async ({ page }) => {
  // Supply a single valid SSE snapshot, then simulate an open but silent stream.
  await page.addInitScript(() => {
    class SilentEventSource {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      readyState = 1;

      constructor() {
        setTimeout(() => {
          this.onopen?.();
          this.onmessage?.({
            data: JSON.stringify({
              runId: '123e4567-e89b-42d3-a456-426614174000',
              seq: 1,
              timestamp: new Date().toISOString(),
              state: {
                isRunning: false,
                estopLatched: false,
                isManualMode: false,
                isHeaterOn: false,
                valveOpen: false,
                rpm: 0,
                temp: 24.5,
                ph: 7,
                level: 65,
                targetRpmManual: 500,
                targetTempManual: 60,
              },
              network: { packetCount: 0, latencyMs: 15, errorCount: 0 },
              traffic: [],
              audit: [],
              alerts: [],
              aiBusy: false,
            }),
          });
        }, 50);
      }

      close() {
        this.readyState = 2;
      }
    }
    Object.defineProperty(window, 'EventSource', { value: SilentEventSource });
  });

  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  await expect(page.getByText('Gateway Stale')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('telemetry-warning')).toContainText('TELEMETRY NOT LIVE');
  await expect(page.getByTestId('telemetry-run-id')).toContainText('123e4567');
  await expect(page.getByRole('button', { name: /^start$/i })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Manual mode' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Heater' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Discharge valve' })).toBeDisabled();
  await expect(page.getByRole('slider', { name: 'Target RPM' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^e-stop$/i })).toBeEnabled();
});

test('manual setpoint sliders follow an external operator session', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  await command(request, { type: 'set_mode', manual: true });
  await expect(page.getByText(/System Mode: Manual Override/i)).toBeVisible();

  await command(request, { type: 'set_rpm_setpoint', value: 860 });
  await command(request, { type: 'set_temp_setpoint', value: 67.5 });
  await expect(page.getByText('860 RPM')).toBeVisible();
  await expect(page.getByText('67.5 °C')).toBeVisible();

  // A second write from the same shared process must replace the idle slider's value.
  await command(request, { type: 'set_rpm_setpoint', value: 720 });
  await expect(page.getByText('720 RPM')).toBeVisible();
});

test('rejected manual setpoint reverts to the server readback', async ({ page, request }) => {
  await command(request, { type: 'set_rpm_setpoint', value: 500 });
  await command(request, { type: 'set_mode', manual: true });
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  await expect(page.getByText('500 RPM')).toBeVisible();

  let attemptedWrites = 0;
  await page.route('**/api/command', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.type !== 'set_rpm_setpoint') return route.continue();
    attemptedWrites += 1;
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, reason: 'Simulated command denial.' }),
    });
  });

  await page.getByRole('slider', { name: 'Target RPM' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Action Denied', { exact: true })).toBeVisible();
  await expect(page.getByText('500 RPM')).toBeVisible();
  expect(attemptedWrites).toBe(1);
});

test('manual sliders are disabled when the E-STOP latch is active', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  await command(request, { type: 'set_mode', manual: true });
  await expect(page.getByText(/System Mode: Manual Override/i)).toBeVisible();
  await command(request, { type: 'estop' });
  await expect(page.getByRole('button', { name: /^reset e-stop$/i })).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Target RPM' })).toBeDisabled();
  await expect(page.getByRole('slider', { name: 'Target temperature' })).toBeDisabled();
});

test('alarm archive defaults to current simulator session', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  const response = await request.get('/api/alerts?limit=10');
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.runId).toMatch(/^[0-9a-f-]{36}$/);
  expect(Array.isArray(body.alerts)).toBe(true);
  expect(body.alerts.length).toBeLessThanOrEqual(10);
  for (const alert of body.alerts) expect(alert.runId).toBe(body.runId);
});

test('ordinary controls stay locked until an SSE snapshot is validated', async ({ page }) => {
  await page.addInitScript(() => {
    class SilentEventSource {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      readyState = 1;

      constructor() {
        setTimeout(() => this.onopen?.(), 50);
      }

      close() {
        this.readyState = 2;
      }
    }

    Object.defineProperty(window, 'EventSource', { value: SilentEventSource });
  });

  await page.goto('/');
  await expect(page.getByText('Gateway Connecting')).toBeVisible();
  await expect(page.getByRole('button', { name: /^start$/i })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Heater' })).toBeDisabled();
  await expect(page.getByRole('switch', { name: 'Discharge valve' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^e-stop$/i })).toBeEnabled();
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

  await page.getByRole('button', { name: /^e-stop$/i }).click();
  await expect(page.locator('footer')).toContainText('STATE: E-STOP LATCHED', { timeout: 5_000 });
  await expect(page.locator('footer')).toContainText('LOCK: E-STOP');
  await expect(page.getByText(/E-STOP LATCHED — reset before restarting/)).toBeVisible();

  // The server, not only the disabled button, must reject subsequent restart.
  const denied = await command(request, { type: 'start' });
  expect(denied.status()).toBe(409);
  await expect(page.getByRole('button', { name: /^start$/i })).toBeDisabled();

  await page.getByRole('button', { name: /^reset e-stop$/i }).click();
  await expect(page.locator('footer')).toContainText('STATE: IDLE', { timeout: 5_000 });
  await expect(page.locator('footer')).toContainText('LOCK: READY');
  await expect(page.getByRole('button', { name: /^start$/i })).toBeEnabled();
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
