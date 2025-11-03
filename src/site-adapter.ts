/**
 * Site Adapter - Playwright selectors and navigation helpers
 *
 * This module encapsulates all website-specific knowledge:
 * - Selectors for login, calendar, forms
 * - Navigation patterns (direct URLs, iframe handling)
 * - Unlock polling for date availability
 * - Form submission with value-based slot selection
 */

import { Page, Frame } from 'playwright';
import { formatDateForUrl } from './time-cr';

// ============================================================================
// CONSTANTS
// ============================================================================

export const SELECTORS = {
  // Login page
  login: {
    usernameInput: 'input[name="number"]',
    passwordInput: 'input[name="pass"]',
    submitButton: 'button[type="submit"], input[type="submit"]',
  },

  // Dashboard
  dashboard: {
    reservationsLink: 'a[href="pre_reservations.php"]',
  },

  // Pre-reservation modal (iframe)
  preReservation: {
    iframe: 'iframe',
    areaSelect: '#area',
    continueButton: 'input#btn_cont',
  },

  // Calendar (iframe)
  calendar: {
    clickableDay: (date: string) => `td.calendar-day_clickable[onclick*="${date}"]`,
    anyClickableDay: 'td.calendar-day_clickable',
  },

  // Day view (nested iframe)
  dayView: {
    reservationLink: 'a[href*="new_reservation.php"]',
  },

  // Reservation form (nested iframe)
  form: {
    scheduleSelect: '#schedule',
    submitButton: '#save_btn',
  },
};

// Time slot value mappings (database IDs from the form)
export const TIME_SLOT_VALUES: Record<string, string> = {
  '06:00 AM - 07:00 AM': '243',
  '07:00 AM - 08:00 AM': '250',
  '08:00 AM - 09:00 AM': '257',
  '09:00 AM - 10:00 AM': '264',
  '10:00 AM - 11:00 AM': '271',
  '11:00 AM - 12:00 PM': '278',
  '12:00 PM - 01:00 PM': '285',
  '01:00 PM - 02:00 PM': '292',
  '02:00 PM - 03:00 PM': '299',
  '03:00 PM - 04:00 PM': '306',
  '04:00 PM - 05:00 PM': '313',
  '05:00 PM - 06:00 PM': '320',
  '06:00 PM - 07:00 PM': '327',
};

// ============================================================================
// URL BUILDERS
// ============================================================================

export interface UrlOptions {
  baseUrl: string;
  areaId: string;
  targetDate: Date;
  cacheBuster?: boolean;
}

/**
 * Build direct calendar URL with optional cache-buster
 */
export function buildCalendarUrl(options: UrlOptions): string {
  const { baseUrl, areaId, targetDate, cacheBuster = true } = options;
  const month = targetDate.getMonth() + 1; // 1-indexed
  const year = targetDate.getFullYear();

  let url = `${baseUrl}reservations.php?month=${month}&year=${year}&area=${areaId}`;

  if (cacheBuster) {
    url += `&ts=${Date.now()}`;
  }

  return url;
}

/**
 * Build direct day view URL (if needed for optimization)
 */
export function buildDayViewUrl(baseUrl: string, date: Date, areaId: string): string {
  const formattedDate = formatDateForUrl(date);
  return `${baseUrl}day.php?day=${formattedDate}&area=${areaId}&ts=${Date.now()}`;
}

// ============================================================================
// IFRAME HELPERS
// ============================================================================

/**
 * Wait for and return the first iframe in the page
 */
export async function waitForIframe(page: Page, timeout = 10000): Promise<Frame> {
  await page.waitForSelector(SELECTORS.preReservation.iframe, { timeout });
  const frames = page.frames();
  const iframe = frames.find(f => f.parentFrame() === page.mainFrame());

  if (!iframe) {
    throw new Error('Could not find iframe');
  }

  return iframe;
}

/**
 * Wait for and return nested iframe (iframe within iframe)
 */
export async function waitForNestedIframe(page: Page, timeout = 10000): Promise<Frame> {
  // Wait for frames to load
  await page.waitForTimeout(500); // Small delay for nested iframe to appear

  const frames = page.frames();

  // Find nested iframe (one whose parent is also an iframe)
  const nestedIframe = frames.find(f => {
    const parent = f.parentFrame();
    return parent && parent !== page.mainFrame();
  });

  if (!nestedIframe) {
    throw new Error('Could not find nested iframe');
  }

  return nestedIframe;
}

// ============================================================================
// UNLOCK POLLING
// ============================================================================

export interface UnlockPollOptions {
  page?: Page;  // Optional - for screenshot on failure
  frame: Frame;
  targetDate: Date;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  onTick?: (elapsed: number) => void;
}

/**
 * Poll for date unlock with configurable interval and max wait
 * Returns elapsed time in milliseconds when date becomes clickable
 */
export async function pollForDateUnlock(options: UnlockPollOptions): Promise<number> {
  const {
    page,
    frame,
    targetDate,
    pollIntervalMs = 180,
    maxWaitMs = 15000,
    onTick,
  } = options;

  const formattedDate = formatDateForUrl(targetDate);
  const selector = SELECTORS.calendar.clickableDay(formattedDate);
  const startTime = Date.now();
  let attemptCount = 0;
  let diagnosticsDumped = false;

  while (true) {
    const elapsed = Date.now() - startTime;
    attemptCount++;

    // On first attempt, dump diagnostic info
    if (!diagnosticsDumped) {
      diagnosticsDumped = true;
      console.log(`[DEBUG] Polling frame URL: ${frame.url()}`);
      console.log(`[DEBUG] Looking for selector: ${selector}`);
      console.log(`[DEBUG] Target date: ${formattedDate}`);

      // Dump calendar HTML snippet
      try {
        const calendarHTML = await frame.evaluate(() => {
          const calendarTable = document.querySelector('table.calendar');
          return calendarTable ? calendarTable.outerHTML.substring(0, 3000) : 'No calendar table found';
        });
        console.log(`[DEBUG] Calendar HTML (first 3000 chars):\n${calendarHTML}`);
      } catch (e) {
        console.log(`[DEBUG] Could not dump calendar HTML: ${e}`);
      }

      // Find all clickable dates
      try {
        const clickableDates = await frame.$$eval('td.calendar-day_clickable', (elements) => {
          return elements.map(el => ({
            text: el.textContent?.trim(),
            onclick: el.getAttribute('onclick'),
            classes: el.className
          }));
        });
        console.log(`[DEBUG] Found ${clickableDates.length} clickable dates:`);
        clickableDates.forEach((d, i) => {
          console.log(`[DEBUG]   ${i + 1}. Text: "${d.text}", onclick: "${d.onclick}"`);
        });
      } catch (e) {
        console.log(`[DEBUG] Could not enumerate clickable dates: ${e}`);
      }
    }

    // Check if date is clickable
    const element = await frame.$(selector);
    if (element) {
      console.log(`[DEBUG] ✅ Date found after ${attemptCount} attempts (${elapsed}ms)`);
      return elapsed;
    }

    // Log every 10 attempts (roughly every 1.8s)
    if (attemptCount % 10 === 0) {
      console.log(`[DEBUG] Poll attempt ${attemptCount}: Date still not clickable (${elapsed}ms elapsed)`);
    }

    // Check timeout
    if (elapsed >= maxWaitMs) {
      // Final diagnostic dump
      console.log(`[DEBUG] ❌ Polling failed after ${attemptCount} attempts over ${elapsed}ms`);

      // Take screenshot if page provided
      if (page) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const screenshotPath = `screenshots/polling-failure-${timestamp}.png`;
          await page.screenshot({ path: screenshotPath });
          console.log(`[DEBUG] Screenshot saved to: ${screenshotPath}`);
        } catch (e) {
          console.log(`[DEBUG] Could not save screenshot: ${e}`);
        }
      }

      throw new Error(
        `Date not clickable after ${maxWaitMs}ms (${attemptCount} attempts) - selector: ${selector}`
      );
    }

    // Callback for logging
    if (onTick) {
      onTick(elapsed);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
}

/**
 * Alternative: Wait for any clickable day (for testing/debugging)
 */
export async function waitForAnyClickableDay(frame: Frame, timeout = 15000): Promise<void> {
  await frame.waitForSelector(SELECTORS.calendar.anyClickableDay, { timeout });
}

// ============================================================================
// FORM INTERACTION
// ============================================================================

export interface SlotSelectionResult {
  success: boolean;
  selectedValue?: string;
  error?: string;
}

/**
 * Select time slot by database value (preferred) with text fallback
 */
export async function selectTimeSlot(
  frame: Frame,
  timeSlot: string
): Promise<SlotSelectionResult> {
  await frame.waitForSelector(SELECTORS.form.scheduleSelect, { timeout: 5000 });

  // Try value-based selection first
  const slotValue = TIME_SLOT_VALUES[timeSlot];

  if (slotValue) {
    // Select by database ID (most reliable)
    const valueExists = await frame.evaluate(
      ({ selectId, value }) => {
        const select = document.getElementById(selectId) as HTMLSelectElement | null;
        if (!select) return false;

        const option = Array.from(select.options).find(opt => opt.value === value);
        if (option) {
          select.value = value;
          return true;
        }
        return false;
      },
      { selectId: 'schedule', value: slotValue }
    );

    if (valueExists) {
      return { success: true, selectedValue: slotValue };
    }
  }

  // Fallback to text matching (for robustness)
  const textMatch = await frame.evaluate(
    ({ selectId, targetText }) => {
      const select = document.getElementById(selectId) as HTMLSelectElement | null;
      if (!select) return { success: false, error: 'Select element not found' };

      const startTime = targetText.split(' - ')[0];
      const option = Array.from(select.options).find(opt =>
        opt.text.includes(startTime)
      );

      if (option) {
        select.value = option.value;
        return { success: true, selectedValue: option.value };
      }

      return {
        success: false,
        error: `No option found matching "${targetText}"`,
      };
    },
    { selectId: 'schedule', targetText: timeSlot }
  );

  return textMatch;
}

/**
 * Click submit button (or skip in shadow mode)
 */
export async function submitReservation(
  frame: Frame,
  shadowMode: boolean
): Promise<{ submitted: boolean; timestamp?: number }> {
  await frame.waitForSelector(SELECTORS.form.submitButton, { timeout: 5000 });

  if (shadowMode) {
    return { submitted: false, timestamp: Date.now() };
  }

  // Click submit
  await frame.evaluate(({ buttonId }) => {
    const btn = document.getElementById(buttonId) as HTMLElement | null;
    if (btn) {
      btn.click();
    } else {
      throw new Error('Submit button not found');
    }
  }, { buttonId: 'save_btn' });

  return { submitted: true, timestamp: Date.now() };
}

// ============================================================================
// LOGIN HELPERS
// ============================================================================

export interface LoginOptions {
  page: Page;
  username: string;
  password: string;
}

/**
 * Perform login and wait for dashboard
 */
export async function performLogin(options: LoginOptions): Promise<void> {
  const { page, username, password } = options;

  // Wait for login form
  await page.waitForSelector(SELECTORS.login.usernameInput, { timeout: 10000 });

  // Fill credentials
  await page.fill(SELECTORS.login.usernameInput, username);
  await page.fill(SELECTORS.login.passwordInput, password);

  // Submit
  await page.click(SELECTORS.login.submitButton);

  // Wait for dashboard
  await page.waitForSelector(SELECTORS.dashboard.reservationsLink, {
    timeout: 30000,
  });
}

/**
 * Check if page shows login form (for session detection)
 */
export async function isLoginPage(page: Page): Promise<boolean> {
  const usernameInput = await page.$(SELECTORS.login.usernameInput);
  return usernameInput !== null;
}

// ============================================================================
// CALENDAR NAVIGATION
// ============================================================================

export interface NavigateToCalendarOptions {
  page: Page;
  areaId: string;
  baseUrl: string;
}

/**
 * Navigate directly to calendar page (bypassing modal)
 */
export async function navigateToCalendar(
  options: NavigateToCalendarOptions,
  targetDate: Date
): Promise<Frame> {
  const { page, areaId, baseUrl } = options;

  // Build direct calendar URL
  const calendarUrl = buildCalendarUrl({
    baseUrl,
    areaId,
    targetDate,
    cacheBuster: true,
  });

  // Navigate to calendar in iframe
  await page.goto(calendarUrl, { waitUntil: 'domcontentloaded' });

  // Return the calendar frame (for iframe-based navigation, adjust as needed)
  return waitForIframe(page);
}

/**
 * Click reservations link and navigate to area selection
 */
export async function openReservationsModal(page: Page): Promise<Frame> {
  await page.waitForSelector(SELECTORS.dashboard.reservationsLink, {
    timeout: 10000,
  });

  // Click reservations link (opens Shadowbox modal with iframe)
  await page.evaluate(() => {
    const link = document.querySelector<HTMLAnchorElement>(
      'a[href="pre_reservations.php"]'
    );
    if (link) {
      link.click();
    }
  });

  // Wait for iframe to load
  return waitForIframe(page);
}

/**
 * Select area and navigate to calendar
 */
export async function selectAreaAndContinue(
  frame: Frame,
  areaId: string
): Promise<void> {
  await frame.waitForSelector(SELECTORS.preReservation.areaSelect, {
    timeout: 10000,
  });

  // Select area
  await frame.selectOption(SELECTORS.preReservation.areaSelect, areaId);

  // Small delay for form state update
  await frame.waitForTimeout(500);

  // Click continue
  await frame.waitForSelector(SELECTORS.preReservation.continueButton, {
    timeout: 5000,
  });
  await frame.click(SELECTORS.preReservation.continueButton);

  // Wait for calendar to load
  await frame.waitForLoadState('domcontentloaded');
}
