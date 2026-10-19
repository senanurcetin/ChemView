import { expect, test, type APIRequestContext } from '@playwright/test';

/** Respect the shared demo command budget instead of assuming the quota is unused. */
const command = async (request: APIRequestContext, body: Record<string, unknown>) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await request.post('/api/command', { data: body });
    if (response.status() !== 429 || body.type === 'estop' || attempt === 3) {
      return response;
    }
    const retrySeconds = Number(response.headers()['retry-after']);
    const delayMs = (Number.isFinite(retrySeconds) && retrySeconds > 0 ? retrySeconds : 10) * 1000;
    await new Promise((resolve) => setTimeout(resolve, delayMs + 100));
  }
  throw new Error('Unable to submit demo command after rate-limit retries');
};

test.beforeEach(async ({ request }) => {
  // The simulation is shared server state: put the plant in a known idle state first.
  expect((await command(request, { type: 'estop' })).status()).toBe(200);
  // E-STOP reset and the remaining commands must actually reach the engine.
  expect((await command(request, { type: 'reset_estop' })).status()).toBe(200);
  expect((await command(request, { type: 'set_valve', open: false })).status()).toBe(200);
  expect((await command(request, { type: 'set_mode', manual: false })).status()).toBe(200);
});

test('NEXUS identity and operator panels remain accessible on shorter desktops', async ({
  page,
}) => {
  for (const size of [
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByText('Gateway Active')).toBeVisible();
    await expect(page.getByRole('img', { name: 'NEXUS' })).toBeVisible();
    await expect(page.getByText('Simulated Process')).toBeVisible();
    await expect(page.getByRole('button', { name: /^e-stop$/i })).toBeVisible();
    await expect(page.getByText('System Event Audit Log')).toBeAttached();

    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      verticalOverflow: getComputedStyle(document.body).overflowY,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.verticalOverflow).not.toBe('hidden');
    const auditHeading = page.getByText('System Event Audit Log');
    await auditHeading.scrollIntoViewIfNeeded();
    await expect(auditHeading).toBeInViewport();

    await page.screenshot({
      path: `artifacts/chemview-hmi-${size.width}x${size.height}.png`,
      fullPage: true,
      animations: 'disabled',
    });
  }
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
              estopEpoch: 0,
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

test('a restarted simulator ignores old-run SSE replays and mismatched audit events', async ({
  page,
}) => {
  await page.addInitScript(() => {
    class ManualEventSource {
      onopen: (() => void) | null = null;
      onmessage: ((event: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      readyState = 1;

      constructor() {
        Object.assign(window, {
          __emitChemViewTestSnapshot: (value: string) => this.onmessage?.({ data: value }),
        });
        setTimeout(() => this.onopen?.(), 0);
      }

      close() {
        this.readyState = 2;
      }
    }
    Object.defineProperty(window, 'EventSource', { value: ManualEventSource });
  });

  await page.goto('/');
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (window as unknown as { __emitChemViewTestSnapshot?: (value: string) => void })
            .__emitChemViewTestSnapshot,
      ),
    )
    .toBe('function');
  const firstRun = '123e4567-e89b-42d3-a456-426614174000';
  const secondRun = '123e4567-e89b-42d3-a456-426614174001';

  const emit = async (runId: string, seq: number, label: string, eventRunId = runId) => {
    await page.evaluate(
      ({ runId, seq, label, eventRunId }) => {
        const timestamp = new Date().toISOString();
        const snapshot = {
          runId,
          seq,
          estopEpoch: 0,
          timestamp,
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
          audit: [
            {
              id: `${label}-audit`,
              runId: eventRunId,
              timestamp,
              message: `${label}-AUDIT`,
              level: 'low',
            },
          ],
          alerts: [
            {
              id: `${label}-alert`,
              runId: eventRunId,
              timestamp,
              message: `${label}-ALERT`,
              source: 'rule',
              urgency: 'medium',
            },
          ],
          aiBusy: false,
        };
        const bridge = window as unknown as { __emitChemViewTestSnapshot: (value: string) => void };
        bridge.__emitChemViewTestSnapshot(JSON.stringify(snapshot));
      },
      { runId, seq, label, eventRunId },
    );
  };

  await emit(firstRun, 1, 'OLD');
  await expect(page.getByTestId('telemetry-run-id')).toHaveAttribute('title', firstRun);
  await expect(page.getByText('OLD-AUDIT')).toHaveCount(1);
  await expect(page.getByText('OLD-ALERT')).toHaveCount(1);

  await emit(secondRun, 1, 'NEW');
  await expect(page.getByTestId('telemetry-run-id')).toHaveAttribute('title', secondRun);
  await expect(page.getByTestId('simulation-restart')).toBeVisible();
  await expect(page.getByText('OLD-AUDIT')).toHaveCount(0);
  await expect(page.getByText('OLD-ALERT')).toHaveCount(0);
  await expect(page.getByText('NEW-AUDIT')).toHaveCount(1);
  await expect(page.getByText('NEW-ALERT')).toHaveCount(1);

  // The old run may arrive with a higher sequence: it is still retired.
  await emit(firstRun, 100, 'REPLAY');
  await expect(page.getByTestId('telemetry-run-id')).toHaveAttribute('title', secondRun);
  await expect(page.getByText('REPLAY-AUDIT')).toHaveCount(0);

  // A mixed-session payload must be rejected rather than partially rendered.
  await emit(secondRun, 2, 'CORRUPT', firstRun);
  await expect(page.getByText('Gateway Disconnected')).toBeVisible();
  await expect(page.getByText('CORRUPT-AUDIT')).toHaveCount(0);
  await emit(secondRun, 3, 'RECOVERED');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  await expect(page.getByText('RECOVERED-AUDIT')).toHaveCount(1);
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

test('audit archive is isolated to the current simulator session', async ({ page, request }) => {
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();

  const runId = await page.getByTestId('telemetry-run-id').getAttribute('title');
  const response = await request.get('/api/audit?limit=50');
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.runId).toBe(runId);
  expect(Array.isArray(payload.entries)).toBe(true);
  expect(payload.entries.length).toBeLessThanOrEqual(50);
  for (const record of payload.entries) expect(record.runId).toBe(runId);
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

test('concurrent heater commands reject an obsolete operator readback', async ({
  page,
  request,
}) => {
  await command(request, { type: 'set_heater', on: false });
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  const runId = await page.getByTestId('telemetry-run-id').getAttribute('title');

  const first = await command(request, {
    type: 'set_heater',
    on: true,
    expectedValue: false,
    expectedRunId: runId,
  });
  expect(first.status()).toBe(200);
  const stale = await command(request, {
    type: 'set_heater',
    on: false,
    expectedValue: false,
    expectedRunId: runId,
  });
  expect(stale.status()).toBe(409);
});

test('an old heater HTTP rejection cannot appear after E-STOP', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();

  let releaseHeater: (() => void) | undefined;
  let intercepted = false;
  let replied = false;
  await page.route('**/api/command', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.type !== 'set_heater') return route.continue();
    intercepted = true;
    await new Promise<void>((resolve) => {
      releaseHeater = resolve;
    });
    await route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, reason: 'Delayed heater denial' }),
    });
    replied = true;
  });

  await page.getByRole('switch', { name: 'Heater' }).click();
  await expect.poll(() => intercepted).toBe(true);
  await page.getByRole('button', { name: /^e-stop$/i }).click();
  await expect(page.locator('footer')).toContainText('STATE: E-STOP LATCHED');

  releaseHeater?.();
  await expect.poll(() => replied).toBe(true);
  // Let the completed fetch settle through the browser's promise handlers.
  await page.waitForTimeout(200);
  await expect(page.getByText('Delayed heater denial')).not.toBeVisible();
  await expect(page.getByText('Action Denied', { exact: true })).not.toBeVisible();
});

test('HMI rejects a local setpoint edit superseded by another operator', async ({
  page,
  request,
}) => {
  await command(request, { type: 'set_rpm_setpoint', value: 500 });
  await command(request, { type: 'set_mode', manual: true });
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();
  await expect(page.getByText('500 RPM')).toBeVisible();

  let attempted: Record<string, unknown> | null = null;
  await page.route('**/api/command', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (body.type !== 'set_rpm_setpoint') return route.continue();
    attempted = body;
    // This request is sent through a separate API context, so it reaches the
    // simulator before the intercepted browser write.
    const externalWrite = await command(request, {
      type: 'set_rpm_setpoint',
      value: 900,
    });
    expect(externalWrite.status()).toBe(200);
    await route.continue();
  });

  await page.getByRole('slider', { name: 'Target RPM' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Action Denied', { exact: true })).toBeVisible();
  await expect(page.getByText('900 RPM')).toBeVisible();

  expect(attempted).toMatchObject({
    type: 'set_rpm_setpoint',
    value: 510,
    expectedValue: 500,
  });
  expect((attempted as unknown as { expectedRunId: string }).expectedRunId).toMatch(
    /^[0-9a-f-]{36}$/,
  );
});

test('stale concurrent operator setpoint writes are rejected', async ({ page, request }) => {
  await command(request, { type: 'set_rpm_setpoint', value: 500 });
  await page.goto('/');
  await expect(page.getByText('Gateway Active')).toBeVisible();

  const runId = await page.getByTestId('telemetry-run-id').getAttribute('title');
  expect(runId).toMatch(/^[0-9a-f-]{36}$/);

  const first = await command(request, {
    type: 'set_rpm_setpoint',
    value: 850,
    expectedValue: 500,
    expectedRunId: runId,
  });
  expect(first.status()).toBe(200);

  const stale = await command(request, {
    type: 'set_rpm_setpoint',
    value: 700,
    expectedValue: 500,
    expectedRunId: runId,
  });
  expect(stale.status()).toBe(409);

  const wrongRun = await command(request, {
    type: 'set_temp_setpoint',
    value: 65,
    expectedValue: 60,
    expectedRunId: '123e4567-e89b-42d3-a456-426614174000',
  });
  expect(wrongRun.status()).toBe(409);
  await expect(page.getByText('Gateway Active')).toBeVisible();
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
  expect((await command(request, { type: 'start' })).status()).toBe(200);

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
