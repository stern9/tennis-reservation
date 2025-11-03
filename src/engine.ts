/**
 * Engine - Playwright browser orchestration and parallel execution
 *
 * This module handles:
 * - Browser context creation with resource blocking
 * - Server time skew correction
 * - Parallel page execution
 * - Session state management and auto-fallback
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

// ============================================================================
// TYPES
// ============================================================================

export interface EngineConfig {
  headless: boolean;
  sessionMode: 'single' | 'contexts';
  blockResources: boolean;
  userAgent?: string;
}

export interface ServerTimeResult {
  serverTime: Date;
  localTime: Date;
  skewMs: number;
}

export interface SessionFallbackEvent {
  court: string;
  reason: 'LOGIN_REDIRECT' | 'AUTH_ERROR' | 'CSRF_ERROR';
  timestamp: Date;
}

// ============================================================================
// BROWSER SETUP
// ============================================================================

/**
 * Launch Playwright browser with optimized settings
 */
export async function launchBrowser(config: EngineConfig): Promise<Browser> {
  const { headless } = config;

  return await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
}

/**
 * Create browser context with resource blocking and cache disabled
 */
export async function createContext(
  browser: Browser,
  config: EngineConfig
): Promise<BrowserContext> {
  const { blockResources, userAgent } = config;

  const context = await browser.newContext({
    userAgent: userAgent || undefined,
    viewport: { width: 1280, height: 720 },
    javaScriptEnabled: true,
  });

  // Disable cache at context level
  await context.addInitScript(() => {
    // Disable service workers
    if ('serviceWorker' in navigator) {
      (navigator.serviceWorker as any).register = () => Promise.resolve();
    }
  });

  // Block resources for speed
  if (blockResources) {
    await context.route('**/*', route => {
      const resourceType = route.request().resourceType();
      const blockedTypes = ['image', 'font', 'stylesheet', 'media'];

      // Also block analytics and tracking
      const url = route.request().url();
      const blockedDomains = [
        'google-analytics.com',
        'googletagmanager.com',
        'facebook.com',
        'doubleclick.net',
      ];

      if (
        blockedTypes.includes(resourceType) ||
        blockedDomains.some(domain => url.includes(domain))
      ) {
        return route.abort();
      }

      return route.continue();
    });
  }

  return context;
}

// ============================================================================
// SERVER TIME SKEW CORRECTION
// ============================================================================

/**
 * Get server time from HTTP Date header
 */
export async function getServerTime(url: string): Promise<ServerTimeResult> {
  const localTime = new Date();

  try {
    const response = await fetch(url, { method: 'HEAD' });
    const dateHeader = response.headers.get('Date');

    if (!dateHeader) {
      return {
        serverTime: localTime,
        localTime,
        skewMs: 0,
      };
    }

    const serverTime = new Date(dateHeader);
    const skewMs = serverTime.getTime() - localTime.getTime();

    return {
      serverTime,
      localTime,
      skewMs,
    };
  } catch (error) {
    // Fallback to local time if HEAD request fails
    return {
      serverTime: localTime,
      localTime,
      skewMs: 0,
    };
  }
}

/**
 * Calculate accurate T0 (midnight) accounting for server skew
 */
export function calculateT0(serverSkewMs: number): Date {
  const now = new Date();
  const serverNow = new Date(now.getTime() + serverSkewMs);
  return serverNow;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export interface SessionState {
  mode: 'single' | 'contexts';
  fallbackApplied: boolean;
  fallbackEvents: SessionFallbackEvent[];
}

/**
 * Create session state tracker
 */
export function createSessionState(initialMode: 'single' | 'contexts'): SessionState {
  return {
    mode: initialMode,
    fallbackApplied: false,
    fallbackEvents: [],
  };
}

/**
 * Check if page indicates session failure
 */
export async function detectSessionFailure(page: Page): Promise<{
  failed: boolean;
  reason?: 'LOGIN_REDIRECT' | 'AUTH_ERROR' | 'CSRF_ERROR';
}> {
  const url = page.url();

  // Check for login redirect
  if (url.includes('login') || url.includes('signin')) {
    return { failed: true, reason: 'LOGIN_REDIRECT' };
  }

  // Check for auth error in page content
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');

  if (bodyText.toLowerCase().includes('unauthorized') || bodyText.toLowerCase().includes('sesión')) {
    return { failed: true, reason: 'AUTH_ERROR' };
  }

  if (bodyText.toLowerCase().includes('csrf') || bodyText.toLowerCase().includes('token')) {
    return { failed: true, reason: 'CSRF_ERROR' };
  }

  return { failed: false };
}

/**
 * Record session fallback event
 */
export function recordFallback(
  sessionState: SessionState,
  court: string,
  reason: 'LOGIN_REDIRECT' | 'AUTH_ERROR' | 'CSRF_ERROR'
): void {
  sessionState.fallbackApplied = true;
  sessionState.fallbackEvents.push({
    court,
    reason,
    timestamp: new Date(),
  });
}

// ============================================================================
// PARALLEL EXECUTION HELPERS
// ============================================================================

export interface CourtExecutionOptions {
  page: Page;
  courtName: string;
  executeReservation: (page: Page) => Promise<any>;
}

/**
 * Execute court reservations in parallel
 */
export async function executeInParallel(
  courts: CourtExecutionOptions[]
): Promise<any[]> {
  const promises = courts.map(async ({ page, courtName, executeReservation }) => {
    try {
      return await executeReservation(page);
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        courtName,
      };
    }
  });

  return await Promise.all(promises);
}

// ============================================================================
// MOCK UNLOCK MODE (ROUTE INTERCEPTION)
// ============================================================================

export interface MockUnlockOptions {
  context: BrowserContext;
  delayMs: number;
}

/**
 * Enable mock unlock mode - delays appearance of "Solicitar Reserva" link
 * This allows testing the polling loop at any time of day
 */
export async function enableMockUnlock(options: MockUnlockOptions): Promise<void> {
  const { context, delayMs } = options;

  await context.route('**/day.php*', async (route, request) => {
    // Delay the response to simulate server unlock timing
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return route.continue();
  });

  await context.route('**/*reservation*.php*', async (route, request) => {
    const url = request.url();

    // Intercept day view responses to delay "Solicitar Reserva" link
    if (url.includes('day.php')) {
      const response = await route.fetch();
      const body = await response.text();

      // Inject delay script
      const modifiedBody = body.replace(
        '</body>',
        `
        <script>
          // Hide reservation link initially
          const hideLink = () => {
            const link = document.querySelector('a[href*="new_reservation.php"]');
            if (link) {
              link.style.display = 'none';
              setTimeout(() => {
                link.style.display = '';
              }, ${delayMs});
            }
          };
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', hideLink);
          } else {
            hideLink();
          }
        </script>
        </body>
        `
      );

      return route.fulfill({
        response,
        body: modifiedBody,
      });
    }

    return route.continue();
  });
}

// ============================================================================
// STORAGE STATE MANAGEMENT
// ============================================================================

/**
 * Save browser context storage state (cookies, localStorage, etc.)
 */
export async function saveStorageState(
  context: BrowserContext,
  filePath: string
): Promise<void> {
  await context.storageState({ path: filePath });
}

/**
 * Load storage state into new context
 */
export async function createContextWithStorage(
  browser: Browser,
  storageStatePath: string,
  config: EngineConfig
): Promise<BrowserContext> {
  const { blockResources, userAgent } = config;

  const context = await browser.newContext({
    storageState: storageStatePath,
    userAgent: userAgent || undefined,
    viewport: { width: 1280, height: 720 },
  });

  // Apply resource blocking
  if (blockResources) {
    await context.route('**/*', route => {
      const resourceType = route.request().resourceType();
      const blockedTypes = ['image', 'font', 'stylesheet', 'media'];

      if (blockedTypes.includes(resourceType)) {
        return route.abort();
      }

      return route.continue();
    });
  }

  return context;
}

// ============================================================================
// TIMING UTILITIES
// ============================================================================

export interface PhaseTimer {
  startTime: number;
  elapsed(): number;
}

/**
 * Create a phase timer for tracking execution time
 */
export function createTimer(): PhaseTimer {
  const startTime = Date.now();

  return {
    startTime,
    elapsed() {
      return Date.now() - startTime;
    },
  };
}

/**
 * Format milliseconds as seconds with 2 decimal places
 */
export function formatMs(ms: number): string {
  return (ms / 1000).toFixed(2);
}
