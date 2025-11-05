import { chromium, Browser, BrowserContext, Page, Frame } from "playwright";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load .env from project root
// When compiled, __dirname will be dist/scripts/, so we need to go up two levels
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

// Import TypeScript utilities
import {
  crMidnight,
  addDaysCR,
  formatDateForUrl,
  getDayOfWeek,
  nowInCR,
  ymdCR,
} from "../src/time-cr";
import {
  waitForReservationIframe,
  detectError,
  dumpFrameContent,
  dumpAllFrames,
} from "../src/error-detection";
import type {
  CourtConfig,
  ReservationResult,
  AppConfig,
  Args,
} from "../src/types";
import * as SiteAdapter from "../src/site-adapter";
import * as Engine from "../src/engine";

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: AppConfig = {
  // Website
  loginUrl: "https://parquesdelsol.sasweb.net/",

  // Credentials (from environment)
  username: process.env.TENNIS_USERNAME,
  password: process.env.TENNIS_PASSWORD,

  // Email notifications (from environment)
  emailTo: process.env.TO_EMAIL_ADDRESS || "stern9@gmail.com",
  emailFrom: process.env.FROM_EMAIL_ADDRESS
    ? `Tennis Reservations <${process.env.FROM_EMAIL_ADDRESS}>`
    : "Tennis Reservations <contact@stern9.dev>",
  resendApiKey: process.env.RESEND_API_KEY,

  // Court configurations
  // Each court has:
  // - areaId: The ID used in the reservation form
  // - name: Display name for logs/emails
  // - daysAhead: How many days in advance this court becomes available
  // - slots: Which days of week to reserve and at what time
  courts: {
    court1: {
      areaId: "5",
      name: "Cancha de Tenis 1",
      daysAhead: 9, // Court 1 becomes available 9 days in advance
      slots: {
        Monday: "06:00 AM - 07:00 AM",
        Tuesday: "06:00 AM - 07:00 AM",
        Wednesday: "06:00 AM - 07:00 AM",
        Thursday: "06:00 AM - 07:00 AM",
        Friday: "06:00 AM - 07:00 AM",
        Saturday: "09:00 AM - 10:00 AM",
      },
    },
    court2: {
      areaId: "7",
      name: "Cancha de Tenis 2",
      daysAhead: 8, // Court 2 becomes available 8 days in advance
      slots: {
        Tuesday: "07:00 AM - 08:00 AM",
        Wednesday: "07:00 AM - 08:00 AM",
        Thursday: "07:00 AM - 08:00 AM",
        Friday: "07:00 AM - 08:00 AM",
      },
    },
  },
};

// Time slot value mappings (database IDs from the form)
// The form uses these IDs as option values, not the display text
const TIME_SLOT_VALUES = {
  "06:00 AM - 07:00 AM": "243",
  "07:00 AM - 08:00 AM": "250",
  "08:00 AM - 09:00 AM": "257",
  "09:00 AM - 10:00 AM": "264",
  "10:00 AM - 11:00 AM": "271",
  "11:00 AM - 12:00 PM": "278",
  "12:00 PM - 01:00 PM": "285",
  "01:00 PM - 02:00 PM": "292",
  "02:00 PM - 03:00 PM": "299",
  "03:00 PM - 04:00 PM": "306",
  "04:00 PM - 05:00 PM": "313",
  "05:00 PM - 06:00 PM": "320",
  "06:00 PM - 07:00 PM": "327",
};

// ============================================================================
// COMMAND LINE ARGUMENTS PARSING
// ============================================================================

const ARGS: Args = {
  test: process.argv.includes("--test"),
  dryRun: process.argv.includes("--dry-run"),
  targetDate: getArgValue("--target-date"),
  court1Time: getArgValue("--court1-time"),
  court2Time: getArgValue("--court2-time"),
  skipCourt1: process.argv.includes("--skip-court1"),
  skipCourt2: process.argv.includes("--skip-court2"),
  debugMode:
    process.env.DEBUG_MODE === "true" || process.argv.includes("--debug"),
  watchMode:
    process.env.WATCH_MODE === "true" || process.argv.includes("--watch"),
  keepScreenshots: process.argv.includes("--keep-screenshots"),
  testDelay: getArgValue("--test-delay"), // Delay in seconds before phase 2
  // New Playwright migration flags
  shadowMode:
    process.env.SHADOW_MODE === "1" || process.argv.includes("--shadow"),
  canaryMode: process.argv.includes("--canary"),
  mockUnlock: process.argv.includes("--mock-unlock"),
  noBooking: process.argv.includes("--no-booking"),
  sessionMode: (process.env.SESSION_MODE === "contexts"
    ? "contexts"
    : "single") as "single" | "contexts",
  unlockMaxMs: parseInt(process.env.UNLOCK_MAX_MS || "15000", 10),
  unlockPollMs: parseInt(process.env.UNLOCK_POLL_MS || "180", 10),
  navMs: parseInt(process.env.NAV_MS || "1500", 10),
  selMs: parseInt(process.env.SEL_MS || "1000", 10),
};

function getArgValue(argName: string): string | null {
  const index = process.argv.indexOf(argName);
  return index !== -1 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : null;
}

// ============================================================================
// LOGGING SETUP
// ============================================================================

// When compiled, __dirname = dist/scripts/, so go up two levels to project root
const logDir = path.join(__dirname, "..", "..", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(
  logDir,
  `reservation-${new Date().toISOString().split("T")[0]}.log`
);

function log(message: string, level: string = "INFO"): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + "\n");
}

// ============================================================================
// SCREENSHOT UTILITIES
// ============================================================================

// When compiled, __dirname = dist/scripts/, so go up two levels to project root
const screenshotDir = path.join(__dirname, "..", "..", "screenshots");
let currentScreenshotSession: string | null = null;

function initScreenshotSession(): string | null {
  if (!ARGS.debugMode) return null;

  const sessionDir = path.join(
    screenshotDir,
    new Date().toISOString().replace(/:/g, "-")
  );
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  currentScreenshotSession = sessionDir;
  log(`Screenshots will be saved to: ${sessionDir}`, "DEBUG");
  return sessionDir;
}

async function takeScreenshot(page: Page, name: string): Promise<void> {
  if (!ARGS.debugMode || !currentScreenshotSession) return;

  try {
    const filepath = path.join(currentScreenshotSession, `${name}.png`);
    await page.screenshot({
      path: filepath as `${string}.png`,
      fullPage: true,
    });
    log(`Screenshot saved: ${name}.png`, "DEBUG");
  } catch (error) {
    log(
      `Failed to take screenshot ${name}: ${(error as Error).message}`,
      "WARN"
    );
  }
}

function cleanupScreenshots() {
  if (!ARGS.debugMode || !currentScreenshotSession) return;
  if (ARGS.keepScreenshots) {
    log(`Screenshots kept at: ${currentScreenshotSession}`, "DEBUG");
    return;
  }

  try {
    if (fs.existsSync(currentScreenshotSession)) {
      fs.rmSync(currentScreenshotSession, { recursive: true, force: true });
      log("Screenshots cleaned up", "DEBUG");
    }
  } catch (error) {
    log(`Failed to cleanup screenshots: ${(error as Error).message}`, "WARN");
  }
}

// ============================================================================
// DATE & TIME UTILITIES
// ============================================================================
// NOTE: Core timezone utilities now imported from src/time-cr.ts
// This fixes the timezone bug where we were using system time instead of CR time

function getCostaRicaTime() {
  // Deprecated: Use nowInCR() instead
  // Keeping for backward compatibility with waitUntilMidnight()
  return nowInCR();
}

function waitUntilMidnight(): Promise<void> {
  return new Promise<void>((resolve) => {
    const checkMidnight = () => {
      const crTime = nowInCR(); // Use correct CR time calculation
      const hours = crTime.getHours();
      const minutes = crTime.getMinutes();
      const seconds = crTime.getSeconds();

      if (hours === 0 && minutes === 0 && seconds === 0) {
        log("🕛 Midnight reached! Starting reservation phase...", "INFO");
        resolve();
      } else {
        const timeLeft = (60 - seconds) * 1000;
        log(
          `⏰ Waiting for midnight... Current CR time: ${crTime.toLocaleTimeString()}`,
          "INFO"
        );
        setTimeout(checkMidnight, Math.min(timeLeft, 1000));
      }
    };
    checkMidnight();
  });
}

/**
 * Milliseconds until the next Costa Rica midnight
 */
function msUntilNextCRMidnight(): number {
  const now = nowInCR();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime() - now.getTime();
}

/**
 * Wait until we are within the pre-login window (e.g., 30 seconds before midnight)
 */
async function waitUntilPreMidnightWindow(offsetMs: number): Promise<void> {
  while (true) {
    const remainingMs = msUntilNextCRMidnight();
    if (remainingMs <= offsetMs) {
      return;
    }

    const waitMs = Math.min(remainingMs - offsetMs, 30000);
    const remainingSeconds = Math.max(
      0,
      Math.round((remainingMs - offsetMs) / 1000)
    );

    log(
      `🕒 ${remainingSeconds}s until login window (midnight minus ${Math.round(
        offsetMs / 1000
      )}s)`,
      "INFO"
    );

    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

// ============================================================================
// EMAIL NOTIFICATION
// ============================================================================

async function sendEmail(
  subject: string,
  body: string,
  attachScreenshots: boolean = false
): Promise<void> {
  if (!CONFIG.resendApiKey) {
    log("RESEND_API_KEY not configured, skipping email notification", "WARN");
    return;
  }

  try {
    log("Sending email via Resend...", "DEBUG");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CONFIG.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONFIG.emailFrom,
        to: [CONFIG.emailTo],
        subject: `🎾 ${subject}`,
        text: body,
        html: `<pre style="font-family: monospace; font-size: 13px;">${body}</pre>`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Resend API error (${response.status}): ${errorData}`);
    }

    const result = await response.json();
    log(`Email sent successfully via Resend (ID: ${result.id})`);
  } catch (error) {
    log(`Failed to send email: ${(error as Error).message}`, "ERROR");
  }
}

// ============================================================================
// PHASE 1: LOGIN (at midnight)
// ============================================================================

async function loginPhase(browser: Browser): Promise<Page> {
  const page = await browser.newPage();

  try {
    log("🔐 Phase 1: Logging in...");

    await page.goto(CONFIG.loginUrl, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await takeScreenshot(page, "1-login-page");

    // Find and fill login form using specific field names
    const usernameInput = await page.$('input[name="number"]');
    const passwordInput = await page.$('input[name="pass"]');

    if (!usernameInput || !passwordInput) {
      log("Could not find login inputs by name, trying by type...", "DEBUG");
      const textInput = await page.$('input[type="text"]');
      const passInput = await page.$('input[type="password"]');

      if (textInput && passInput) {
        await textInput.fill(String(CONFIG.username));
        await passInput.fill(String(CONFIG.password));
      } else {
        throw new Error("Could not find login form inputs");
      }
    } else {
      log(`Filling username field with: ${CONFIG.username}`, "DEBUG");
      await usernameInput.fill(String(CONFIG.username));
      log(`Filling password field`, "DEBUG");
      await passwordInput.fill(String(CONFIG.password));
    }

    log("Credentials entered, clicking login button...");

    await page.click('button, input[type="submit"]');
    log("Waiting for login to complete...");

    // Add delay to let page process the login
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Check what's on the page before waiting for selector
    const currentUrl = page.url();
    log(`Current URL after login click: ${currentUrl}`, "DEBUG");

    try {
      await page.waitForSelector('a[href="pre_reservations.php"]', {
        timeout: 30000,
      });
    } catch (selectorError) {
      // Log page content if selector not found
      const bodyText = await page.evaluate(() =>
        document.body.innerText.substring(0, 500)
      );
      log(`Page content snapshot: ${bodyText}`, "DEBUG");
      throw selectorError;
    }

    await takeScreenshot(page, "2-logged-in-dashboard");
    log("✅ Phase 1 Complete: Logged in successfully");

    return page;
  } catch (error) {
    await takeScreenshot(page, "error-login-phase");
    await page.close();
    throw new Error(`Login failed: ${(error as Error).message}`);
  }
}

// ============================================================================
// PHASE 2: RESERVE (at 12:00am or immediately in test mode)
// ============================================================================

async function reservePhase(
  page: Page,
  courtConfig: CourtConfig,
  targetDate: Date,
  timeSlot: string,
  t0Time?: number
): Promise<ReservationResult> {
  const phaseTimer = Engine.createTimer();
  const telemetry = {
    unlockMs: 0,
    formReadyMs: 0,
    submitMs: 0,
  };

  try {
    log(
      `🎾 Phase 2: Reserving ${
        courtConfig.name
      } on ${targetDate.toDateString()} at ${timeSlot}`
    );

    // T0 telemetry
    if (t0Time) {
      const t0Elapsed = Engine.formatMs(Date.now() - t0Time);
      log(`⏱️  T0 offset: +${t0Elapsed}s from midnight`, "DEBUG");
    }

    // Step 1: Open reservations modal and select area
    log("Opening reservations modal...");
    const modalFrame = await SiteAdapter.openReservationsModal(page);
    await takeScreenshot(page, "3-reservations-modal");

    log(`Selecting ${courtConfig.name}...`);
    await SiteAdapter.selectAreaAndContinue(modalFrame, courtConfig.areaId);

    // Step 2: Wait for calendar to load and find calendar frame
    log("Waiting for calendar to load...");
    await page.waitForTimeout(1000); // Brief wait for modal transition

    const frames = page.frames();
    const calendarFrame = frames.find((f) =>
      f.url().includes("reservations.php")
    );

    if (!calendarFrame) {
      throw new Error("Could not find calendar iframe");
    }

    await calendarFrame.waitForLoadState("domcontentloaded");
    await takeScreenshot(page, "4-calendar-view");

    // Step 3: Navigate to correct month if needed
    const targetMonth = targetDate.getMonth() + 1;
    const targetYear = targetDate.getFullYear();

    const currentCalendarMonth = await calendarFrame.evaluate(() => {
      const monthNames = [
        "ENERO",
        "FEBRERO",
        "MARZO",
        "ABRIL",
        "MAYO",
        "JUNIO",
        "JULIO",
        "AGOSTO",
        "SEPTIEMBRE",
        "OCTUBRE",
        "NOVIEMBRE",
        "DICIEMBRE",
      ];
      const headerText = document.body.innerText;
      const monthMatch = headerText.match(
        /(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\s+(\d{4})/i
      );
      if (monthMatch) {
        const monthIndex = monthNames.indexOf(monthMatch[1].toUpperCase()) + 1;
        return { month: monthIndex, year: parseInt(monthMatch[2]) };
      }
      return null;
    });

    log(
      `Calendar showing: ${currentCalendarMonth?.month}/${currentCalendarMonth?.year}, Target: ${targetMonth}/${targetYear}`,
      "DEBUG"
    );

    // Navigate to target month if needed
    if (
      !currentCalendarMonth ||
      currentCalendarMonth.month !== targetMonth ||
      currentCalendarMonth.year !== targetYear
    ) {
      log(`Navigating to month ${targetMonth}/${targetYear}...`, "DEBUG");
      await calendarFrame.evaluate(
        ({
          month,
          year,
          areaId,
        }: {
          month: number;
          year: number;
          areaId: string;
        }) => {
          window.location.href = `reservations.php?month=${month}&year=${year}&area=${areaId}`;
        },
        { month: targetMonth, year: targetYear, areaId: courtConfig.areaId }
      );
      await calendarFrame.waitForLoadState("domcontentloaded");
    }

    // Step 4: Poll for date unlock (replaces fixed delays)
    log(
      `Polling for date ${formatDateForUrl(targetDate)} to become clickable...`
    );
    const unlockStartTime = Date.now();
    let lastPollSecond = -1;

    try {
      const unlockResult = await SiteAdapter.pollForDateUnlock({
        page,
        frame: calendarFrame,
        targetDate,
        pollIntervalMs: ARGS.unlockPollMs,
        maxWaitMs: ARGS.unlockMaxMs,
        onTick: (elapsed) => {
          const seconds = Math.floor(elapsed / 1000);
          if (seconds !== lastPollSecond) {
            lastPollSecond = seconds;
            log(`  Polling... ${Engine.formatMs(elapsed)}s elapsed`, "DEBUG");
          }
        },
      });

      telemetry.unlockMs = unlockResult.elapsedMs;

      log(
        `✅ Date unlocked after ${unlockResult.reloads} refreshes (T+${Engine.formatMs(
          Date.now() - unlockStartTime
        )}s)`,
        "SUCCESS"
      );
    } catch (unlockError) {
      throw new Error(
        `DATE_NOT_AVAILABLE_YET - ${(unlockError as Error).message}`
      );
    }

    // Step 5: Click date
    const formattedDate = formatDateForUrl(targetDate);
    log(`Clicking date ${formattedDate}...`);
    const dateSelector = `td[onclick*="${formattedDate}"]`;
    await calendarFrame.click(dateSelector);

    // Step 6: Wait for day view iframe
    log("Waiting for day view...");
    const dayViewTimeoutMs = parseInt(
      process.env.DAY_VIEW_TIMEOUT_MS || "4500",
      10
    );
    const dayViewStart = Date.now();
    let dayViewFrame: Frame | null = null;

    while (!dayViewFrame && Date.now() - dayViewStart <= dayViewTimeoutMs) {
      const allFrames = page.frames();

      for (const f of allFrames) {
        const url = f.url();

        if (url.includes("day.php")) {
          dayViewFrame = f;
          break;
        }

        try {
          const hasReserva = await f.evaluate(() => {
            const body = document.body;
            if (!body) return false;
            const text = body.innerText || "";
            return text.includes("Solicitar Reserva");
          });

          if (hasReserva) {
            dayViewFrame = f;
            break;
          }
        } catch {
          // Ignore frames that fail evaluation (likely still loading)
        }
      }

      if (!dayViewFrame) {
        await page.waitForTimeout(120);
      }
    }

    const allFrames = page.frames();

    if (dayViewFrame) {
      log(
        `Found day view frame after ${Engine.formatMs(
          Date.now() - dayViewStart
        )}s`,
        "DEBUG"
      );
    }
    if (!dayViewFrame) {
      log(
        `Day view not found after ${Engine.formatMs(
          Date.now() - dayViewStart
        )}s – inspecting frames (${allFrames.length} total)`,
        "DEBUG"
      );

      allFrames.forEach((f, idx) =>
        log(`  Frame ${idx}: ${f.url()}`, "DEBUG")
      );

      // Check for "date not available" message
      for (const f of allFrames) {
        try {
          const text = await f.evaluate(() =>
            document.body.innerText.toLowerCase()
          );
          if (
            text.includes("aún no está disponible") ||
            text.includes("aun no esta disponible") ||
            text.includes("no se encuentra habilitada")
          ) {
            throw new Error(
              "DATE_NOT_AVAILABLE_YET - Date not available for reservation yet"
            );
          }
        } catch (e) {
          if ((e as Error).message.includes("DATE_NOT_AVAILABLE_YET")) {
            throw e;
          }
        }
      }
      throw new Error("Could not find day view iframe");
    }

    await takeScreenshot(page, "5-day-view");

    // Step 7: Click "Solicitar Reserva" link
    log("Opening reservation form...");
    await dayViewFrame.waitForSelector('a[href*="new_reservation.php"]', {
      timeout: 5000,
    });
    await dayViewFrame.click('a[href*="new_reservation.php"]');

    // Step 8: Wait for form and select time slot
    await page.waitForTimeout(500); // Brief wait for form iframe

    let formFrame = null;
    for (const f of page.frames()) {
      if (f.url().includes("new_reservation.php")) {
        formFrame = f;
        break;
      }
    }

    if (!formFrame) {
      throw new Error("Could not find reservation form iframe");
    }

    telemetry.formReadyMs = phaseTimer.elapsed();
    log(
      `✅ Form ready at T+${Engine.formatMs(telemetry.formReadyMs)}s`,
      "SUCCESS"
    );

    // Step 9: Select time slot using SiteAdapter
    log(`Selecting time slot: ${timeSlot}...`);
    const slotResult = await SiteAdapter.selectTimeSlot(formFrame, timeSlot);

    if (!slotResult.success) {
      throw new Error(
        `TIME_SLOT_NOT_FOUND: ${
          slotResult.error || `Could not find time slot: ${timeSlot}`
        }`
      );
    }

    log(`Selected slot value: ${slotResult.selectedValue}`, "DEBUG");
    await takeScreenshot(page, "6-form-filled");

    // Step 10: Check ALLOW_BOOKING dead-man switch
    const allowBooking =
      process.env.ALLOW_BOOKING === "1" ||
      (fs.existsSync("/tmp/allow_booking") && !ARGS.noBooking);

    if (!allowBooking && !ARGS.shadowMode) {
      log(
        "⚠️  ALLOW_BOOKING not set - submission blocked by dead-man switch",
        "WARN"
      );
      log(
        "To enable real bookings, set ALLOW_BOOKING=1 or create /tmp/allow_booking",
        "WARN"
      );
    }

    const shouldSubmit = !ARGS.shadowMode && allowBooking;

    // Step 11: Submit (or skip in shadow mode)
    if (ARGS.shadowMode) {
      log("🔮 SHADOW MODE: Skipping submission", "WARN");
      telemetry.submitMs = phaseTimer.elapsed();
      log(
        `Would have submitted at T+${Engine.formatMs(telemetry.submitMs)}s`,
        "WARN"
      );

      return {
        success: true,
        court: courtConfig.name,
        date: targetDate.toDateString(),
        time: timeSlot,
        telemetry,
      };
    }

    if (!shouldSubmit) {
      log("⚠️  Submission blocked by ALLOW_BOOKING switch", "WARN");
      telemetry.submitMs = phaseTimer.elapsed();
      return {
        success: false,
        court: courtConfig.name,
        date: targetDate.toDateString(),
        time: timeSlot,
        error: "BLOCKED_BY_ALLOW_BOOKING",
        telemetry,
      };
    }

    log("Submitting reservation...");

    // In watch mode, pause before submitting
    if (ARGS.watchMode) {
      log(
        "WATCH MODE: Pausing 5 seconds before submission. Browser will stay open.",
        "DEBUG"
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    const submitResult = await SiteAdapter.submitReservation(
      formFrame,
      ARGS.shadowMode
    );

    telemetry.submitMs = phaseTimer.elapsed();
    log(`✅ Submitted at T+${Engine.formatMs(telemetry.submitMs)}s`, "SUCCESS");

    // Step 12: Wait for result
    log("Waiting for result iframe...", "DEBUG");

    let resultFrame;
    try {
      resultFrame = await waitForReservationIframe(page, { timeout: 10000 });
      log(`Found result frame: ${resultFrame.url()}`, "DEBUG");
    } catch (waitError) {
      const allFrameUrls = page.frames().map((f) => f.url());
      log(
        `Failed to find result frame. All frames: ${JSON.stringify(
          allFrameUrls
        )}`,
        "ERROR"
      );
      throw new Error(
        `Timed out waiting for reservation result frame: ${
          (waitError as Error).message
        }`
      );
    }

    await takeScreenshot(page, "7-submission-result");

    // Step 13: Detect result
    const errorResult = await detectError(resultFrame);

    if (ARGS.debugMode) {
      await dumpFrameContent(
        resultFrame,
        path.join(currentScreenshotSession || ".", "submission-result.txt")
      );
    }

    log(
      `Detection result: ${errorResult.type} - ${errorResult.message}`,
      "DEBUG"
    );

    if (errorResult.type === "SUCCESS") {
      log(
        `✅ SUCCESS: Reserved ${
          courtConfig.name
        } on ${targetDate.toDateString()} at ${timeSlot}`,
        "SUCCESS"
      );
      return {
        success: true,
        court: courtConfig.name,
        date: targetDate.toDateString(),
        time: timeSlot,
        telemetry,
      };
    } else if (errorResult.type === "SLOT_TAKEN") {
      throw new Error(`SLOT_TAKEN: ${errorResult.message}`);
    } else if (errorResult.type === "RESERVATION_LIMIT") {
      throw new Error(`RESERVATION_LIMIT: ${errorResult.message}`);
    } else if (errorResult.type === "NOT_YET_AVAILABLE") {
      throw new Error(`DATE_NOT_AVAILABLE_YET: ${errorResult.message}`);
    } else {
      if (ARGS.debugMode) {
        await dumpAllFrames(
          page,
          path.join(currentScreenshotSession || ".", "all-frames-unknown.txt")
        );
      }
      const extra = errorResult.rawMessage
        ? ` - Raw: "${errorResult.rawMessage}"`
        : "";
      throw new Error(
        `UNKNOWN_ERROR: Could not classify reservation response - ${errorResult.message}${extra}`
      );
    }
  } catch (error) {
    await takeScreenshot(page, "error-reserve-phase");
    throw error;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  log("=== Tennis Court Reservation Script Started ===");
  log(
    `Mode: ${ARGS.test ? "TEST" : "PRODUCTION"}${
      ARGS.dryRun ? " (DRY RUN)" : ""
    }${ARGS.debugMode ? " (DEBUG)" : ""}${ARGS.shadowMode ? " (SHADOW)" : ""}`
  );

  const results: ReservationResult[] = [];
  const errors: { court: string; date: string; time: string; error: string }[] =
    [];
  let browser: Browser | undefined;
  let t0Time: number | undefined;

  try {
    // Initialize screenshot session if in debug mode
    initScreenshotSession();

    // Get server time skew correction
    if (!ARGS.test) {
      log("Checking server time skew...");
      const serverTimeResult = await Engine.getServerTime(CONFIG.loginUrl);
      log(
        `Server time: ${serverTimeResult.serverTime.toISOString()}, Local time: ${serverTimeResult.localTime.toISOString()}`,
        "DEBUG"
      );
      log(`Server skew: ${serverTimeResult.skewMs}ms`, "DEBUG");

      if (Math.abs(serverTimeResult.skewMs) > 1000) {
        log(
          `⚠️  Significant time skew detected: ${serverTimeResult.skewMs}ms`,
          "WARN"
        );
      }
    }

    // Target date calculation - different timing for test vs production
    let targetDateCourt1: Date | null = null;
    let targetDateCourt2: Date | null = null;

    if (ARGS.test && ARGS.targetDate) {
      // Test mode with specific date - calculate immediately
      const [year, month, day] = ARGS.targetDate.split("-").map(Number);
      targetDateCourt1 = new Date(year, month - 1, day);
      targetDateCourt2 = new Date(year, month - 1, day);
      log(`TEST MODE: Using date ${ARGS.targetDate}`);

      // Show info for test mode
      const dayOfWeek1 = getDayOfWeek(targetDateCourt1);
      const dayOfWeek2 = getDayOfWeek(targetDateCourt2);
      log(`Court 1 target: ${targetDateCourt1.toDateString()} (${dayOfWeek1})`);
      log(`Court 2 target: ${targetDateCourt2.toDateString()} (${dayOfWeek2})`);
    } else if (!ARGS.test) {
      // Production mode: Will calculate dates AFTER waiting for midnight
      // This ensures we use the correct "today" value (Oct 10), not the stale value from 11:58 PM (Oct 9)
      log(
        "Production mode: Target dates will be calculated after midnight",
        "DEBUG"
      );
    } else {
      log("ERROR: Test mode requires --target-date parameter", "ERROR");
      process.exit(1);
    }

    // Launch browser
    const launchOptions = {
      headless: !ARGS.watchMode,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };

    if (!ARGS.watchMode) {
      launchOptions.args.push("--disable-dev-shm-usage", "--disable-gpu");
    }

    browser = await chromium.launch(launchOptions);

    // Enable mock unlock mode if flag set
    if (ARGS.mockUnlock) {
      log("🧪 MOCK UNLOCK MODE: Enabling mock unlock with 5s delay", "WARN");
      const context = await browser.newContext();
      await Engine.enableMockUnlock({
        context,
        delayMs: 5000, // Simulate 5-second delay before date becomes clickable
      });
      log("Mock unlock mode enabled", "DEBUG");
    }

    // Pre-login timing: start authentication close to midnight to reuse fresh session
    const loginLeadMs = parseInt(process.env.LOGIN_LEAD_MS || "30000", 10);
    if (!ARGS.test) {
      const crTime = nowInCR();
      log(`Current Costa Rica time: ${crTime.toLocaleTimeString()}`);

      if (msUntilNextCRMidnight() > loginLeadMs) {
        log(
          `Waiting until ${Math.round(loginLeadMs / 1000)}s before midnight to log in...`
        );
        await waitUntilPreMidnightWindow(loginLeadMs);
      }

      const secondsUntilMidnight = Math.max(
        0,
        Math.round(msUntilNextCRMidnight() / 1000)
      );
      log(
        `🚪 Entering login window: ${secondsUntilMidnight}s until midnight`,
        "INFO"
      );
    }

    // PHASE 1: Login (start ~30s before midnight in production, immediate in test mode)

    // Create browser context (needed for parallel execution)
    const context = await browser.newContext();
    const loginPage = await context.newPage();

    // Perform login
    try {
      log("🔐 Phase 1: Logging in...");
      await loginPage.goto(CONFIG.loginUrl, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await takeScreenshot(loginPage, "1-login-page");

      const usernameInput = await loginPage.$('input[name="number"]');
      const passwordInput = await loginPage.$('input[name="pass"]');

      if (!usernameInput || !passwordInput) {
        log("Could not find login inputs by name, trying by type...", "DEBUG");
        const textInput = await loginPage.$('input[type="text"]');
        const passInput = await loginPage.$('input[type="password"]');

        if (textInput && passInput) {
          await textInput.fill(String(CONFIG.username));
          await passInput.fill(String(CONFIG.password));
        } else {
          throw new Error("Could not find login form inputs");
        }
      } else {
        log(`Filling username field with: ${CONFIG.username}`, "DEBUG");
        await usernameInput.fill(String(CONFIG.username));
        log(`Filling password field`, "DEBUG");
        await passwordInput.fill(String(CONFIG.password));
      }

      log("Credentials entered, clicking login button...");
      await loginPage.click('button, input[type="submit"]');
      log("Waiting for login to complete...");
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const currentUrl = loginPage.url();
      log(`Current URL after login click: ${currentUrl}`, "DEBUG");

      try {
        await loginPage.waitForSelector('a[href="pre_reservations.php"]', {
          timeout: 30000,
        });
      } catch (selectorError) {
        const bodyText = await loginPage.evaluate(() =>
          document.body.innerText.substring(0, 500)
        );
        log(`Page content snapshot: ${bodyText}`, "DEBUG");
        throw selectorError;
      }

      await takeScreenshot(loginPage, "2-logged-in-dashboard");
      log("✅ Phase 1 Complete: Logged in successfully");
    } catch (error) {
      await takeScreenshot(loginPage, "error-login-phase");
      throw new Error(`Login failed: ${(error as Error).message}`);
    }

    if (!ARGS.test) {
      const remainingToMidnight = msUntilNextCRMidnight();
      if (remainingToMidnight > 0) {
        log(
          `⏳ Waiting ${Math.ceil(
            remainingToMidnight / 1000
          )}s for midnight after login...`
        );
        await waitUntilMidnight();
      } else {
        log("⚠️ Midnight reached during login, continuing immediately", "WARN");
      }

      t0Time = Date.now();
      log(`🕛 T0 reached at ${new Date(t0Time).toISOString()}`, "INFO");
    }

    // Calculate target dates (only in production mode, after midnight)
    if (!ARGS.test) {
      // Midnight has passed, so "today" reflects the correct CR day (e.g., Oct 13, not Oct 12)
      const today = crMidnight();

      // Log timezone info for debugging
      const systemNow = new Date();
      const crNow = nowInCR();
      log(`System time: ${systemNow.toISOString()}`, "DEBUG");
      log(`Costa Rica time: ${crNow.toISOString()}`, "DEBUG");
      log(`Today (CR): ${today.toDateString()}`, "DEBUG");

      targetDateCourt1 = addDaysCR(today, CONFIG.courts.court1.daysAhead);
      targetDateCourt2 = addDaysCR(today, CONFIG.courts.court2.daysAhead);

      log(
        `Production target Court 1: ${ymdCR(targetDateCourt1)} (${
          CONFIG.courts.court1.daysAhead
        } days from CR today)`,
        "DEBUG"
      );
      log(
        `Production target Court 2: ${ymdCR(targetDateCourt2)} (${
          CONFIG.courts.court2.daysAhead
        } days from CR today)`,
        "DEBUG"
      );

      const dayOfWeek1 = getDayOfWeek(targetDateCourt1);
      const dayOfWeek2 = getDayOfWeek(targetDateCourt2);

      log(`Today: ${today.toDateString()}`);
      log(`Court 1 target: ${targetDateCourt1.toDateString()} (${dayOfWeek1})`);
      log(`Court 2 target: ${targetDateCourt2.toDateString()} (${dayOfWeek2})`);
    } else if (ARGS.testDelay) {
      // Test mode with delay - simulate production timing
      const delaySeconds = parseInt(ARGS.testDelay, 10);
      log(
        `⏰ TEST DELAY: Waiting ${delaySeconds} seconds before Phase 2 (simulating production timing)...`
      );

      let remaining = delaySeconds;
      while (remaining > 0) {
        if (remaining % 30 === 0 || remaining <= 10) {
          log(`⏰ ${remaining} seconds until Phase 2 starts...`);
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
        remaining--;
      }

      log("⏰ Delay complete! Starting Phase 2 now...");
    }

    // PHASE 2: Make reservations
    // Safety check - ensure dates were calculated
    if (!targetDateCourt1 || !targetDateCourt2) {
      throw new Error(
        "Target dates were not calculated - this should never happen"
      );
    }

    // Calculate which days of week and time slots to use
    const dayOfWeek1 = getDayOfWeek(targetDateCourt1);
    const dayOfWeek2 = getDayOfWeek(targetDateCourt2);

    const court1TimeSlot =
      ARGS.court1Time || CONFIG.courts.court1.slots[dayOfWeek1];
    const court2TimeSlot =
      ARGS.court2Time || CONFIG.courts.court2.slots[dayOfWeek2];

    const shouldReserveCourt1 = court1TimeSlot && !ARGS.skipCourt1;
    const shouldReserveCourt2 = court2TimeSlot && !ARGS.skipCourt2;

    if (!shouldReserveCourt1 && !shouldReserveCourt2) {
      log("No reservations needed for these dates");
      return;
    }

    if (ARGS.dryRun) {
      log("=== DRY RUN MODE - NO ACTUAL RESERVATIONS WILL BE MADE ===");
      if (shouldReserveCourt1)
        log(
          `Would reserve: Court 1 on ${targetDateCourt1.toDateString()} at ${court1TimeSlot}`
        );
      if (shouldReserveCourt2)
        log(
          `Would reserve: Court 2 on ${targetDateCourt2.toDateString()} at ${court2TimeSlot}`
        );
      return;
    }

    // Choose execution strategy based on SESSION_MODE
    if (
      ARGS.sessionMode === "single" &&
      shouldReserveCourt1 &&
      shouldReserveCourt2
    ) {
      log("🚀 SESSION_MODE=single: Executing both courts in parallel", "INFO");

      // Create second page from same context (shares session)
      const loginPage2 = await context.newPage();

      // Navigate second page to dashboard (shares cookies/session with first page)
      log("Navigating Court 2 page to dashboard...", "DEBUG");
      await loginPage2.goto(loginPage.url(), { waitUntil: "networkidle" });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      log("Court 2 page ready", "DEBUG");

      // Execute both reservations in parallel with slight stagger to avoid modal conflicts
      const parallelResults = await Promise.allSettled([
        (async () => {
          log("--- Starting Court 1 Reservation (Parallel) ---");
          return await reservePhase(
            loginPage,
            CONFIG.courts.court1,
            targetDateCourt1,
            court1TimeSlot,
            t0Time
          );
        })(),
        (async () => {
          // Delay Court 2 by 100ms to avoid modal conflict with Court 1
          await new Promise((resolve) => setTimeout(resolve, 100));
          log("--- Starting Court 2 Reservation (Parallel) ---");
          return await reservePhase(
            loginPage2,
            CONFIG.courts.court2,
            targetDateCourt2,
            court2TimeSlot,
            t0Time
          );
        })(),
      ]);

      // Process results
      parallelResults.forEach((result, index) => {
        const courtName = index === 0 ? "Court 1" : "Court 2";
        const courtDate = index === 0 ? targetDateCourt1 : targetDateCourt2;
        const courtTime = index === 0 ? court1TimeSlot : court2TimeSlot;

        if (result.status === "fulfilled") {
          results.push(result.value);
          log(`✅ ${courtName} completed successfully`, "SUCCESS");
        } else {
          errors.push({
            court: courtName,
            date: courtDate.toDateString(),
            time: courtTime,
            error: result.reason.message,
          });
          log(`❌ ${courtName} failed: ${result.reason.message}`, "ERROR");
        }
      });

      log("✅ Parallel execution completed", "INFO");

      // Session fallback detection
      const hasAuthErrors = errors.some(
        (e) =>
          e.error.toLowerCase().includes("login") ||
          e.error.toLowerCase().includes("auth") ||
          e.error.toLowerCase().includes("session") ||
          e.error.toLowerCase().includes("csrf")
      );

      if (hasAuthErrors) {
        log(
          "⚠️  SESSION FAILURE DETECTED: Auth-related errors found in parallel mode",
          "WARN"
        );
        log(
          "Consider setting SESSION_MODE=contexts to use separate browser contexts per court",
          "WARN"
        );
        log(
          "This typically resolves session sharing issues between parallel reservations",
          "WARN"
        );
      }
    } else {
      // Sequential execution (SESSION_MODE=contexts or single court only)
      if (ARGS.sessionMode === "contexts") {
        log(
          "SESSION_MODE=contexts: Executing courts sequentially with separate sessions",
          "INFO"
        );
      }

      if (shouldReserveCourt1) {
        log("--- Starting Court 1 Reservation ---");
        try {
          const result = await reservePhase(
            loginPage,
            CONFIG.courts.court1,
            targetDateCourt1,
            court1TimeSlot,
            t0Time
          );
          results.push(result);
        } catch (error) {
          errors.push({
            court: "Court 1",
            date: targetDateCourt1.toDateString(),
            time: court1TimeSlot,
            error: (error as Error).message,
          });
        }
      }

      if (shouldReserveCourt2) {
        log("--- Starting Court 2 Reservation ---");

        // Only create separate context if BOTH courts are running (to avoid modal conflicts)
        // If only Court 2 is running, reuse existing loginPage (saves 7+ seconds)
        let loginPage2 = loginPage;

        if (shouldReserveCourt1 && ARGS.sessionMode === "contexts") {
          // Both courts running - need separate context to avoid interference
          log(
            "Creating separate context for Court 2 (both courts active)",
            "DEBUG"
          );
          const context2 = await browser.newContext();
          loginPage2 = await context2.newPage();

          // Login for Court 2
          try {
            log("Logging in for Court 2...", "DEBUG");
            await loginPage2.goto(CONFIG.loginUrl, {
              waitUntil: "networkidle",
            });
            await new Promise((resolve) => setTimeout(resolve, 2000));

            await loginPage2.fill(
              'input[name="number"]',
              String(CONFIG.username)
            );
            await loginPage2.fill(
              'input[name="pass"]',
              String(CONFIG.password)
            );
            await loginPage2.click('button, input[type="submit"]');
            await new Promise((resolve) => setTimeout(resolve, 3000));
            await loginPage2.waitForSelector('a[href="pre_reservations.php"]', {
              timeout: 30000,
            });
            log("Court 2 login successful", "DEBUG");
          } catch (error) {
            throw new Error(
              `Court 2 login failed: ${(error as Error).message}`
            );
          }
        } else {
          log(
            "Reusing existing session for Court 2 (single court mode)",
            "DEBUG"
          );
        }

        try {
          const result = await reservePhase(
            loginPage2,
            CONFIG.courts.court2,
            targetDateCourt2,
            court2TimeSlot,
            t0Time
          );
          results.push(result);
        } catch (error) {
          errors.push({
            court: "Court 2",
            date: targetDateCourt2.toDateString(),
            time: court2TimeSlot,
            error: (error as Error).message,
          });
        }
      }
    }

    // Send summary email
    let emailBody = "=== Tennis Court Reservation Summary ===\n\n";

    if (results.length > 0) {
      // Change wording based on shadow mode
      if (ARGS.shadowMode || ARGS.test) {
        emailBody += "🔮 SHADOW MODE - WOULD HAVE RESERVED:\n";
        emailBody += "(No actual bookings were made - this was a test run)\n\n";
      } else {
        emailBody += "✅ REAL BOOKINGS CONFIRMED:\n";
      }

      results.forEach((r) => {
        const prefix = ARGS.shadowMode || ARGS.test ? "🧪" : "✅";
        emailBody += `${prefix} ${r.court} - ${r.date} at ${r.time}\n`;

        // Add telemetry if available
        if (r.telemetry) {
          emailBody += `   📊 Performance:\n`;
          emailBody += `      Unlock: T+${Engine.formatMs(
            r.telemetry.unlockMs
          )}s\n`;
          emailBody += `      Form ready: T+${Engine.formatMs(
            r.telemetry.formReadyMs
          )}s\n`;
          emailBody += `      Submit: T+${Engine.formatMs(
            r.telemetry.submitMs
          )}s\n`;
        }
        emailBody += "\n";
      });
    }

    if (errors.length > 0) {
      emailBody += "FAILED RESERVATIONS:\n";
      errors.forEach((e) => {
        emailBody += `❌ ${e.court} - ${e.date} at ${e.time}\n`;
        emailBody += `   Error: ${e.error}\n\n`;
      });
    }

    emailBody += `\n📅 Run time: ${new Date().toISOString()}`;
    if (t0Time) {
      emailBody += `\n⏱️  T0 (midnight): ${new Date(t0Time).toISOString()}`;
    }
    if (ARGS.shadowMode) {
      emailBody += `\n🔮 Mode: SHADOW (no actual submissions)`;
    }
    emailBody += `\n📄 Log file: ${logFile}`;

    const subject =
      results.length > 0 && errors.length === 0
        ? `Reservations Confirmed ✅ (${results.length}/${results.length})`
        : results.length > 0 && errors.length > 0
        ? `Partial Success ⚠️ (${results.length}/${
            results.length + errors.length
          })`
        : `Reservation Failed ❌`;

    // Add test/shadow prefix to subject
    const emailSubject =
      ARGS.test || ARGS.shadowMode ? `[TEST] ${subject}` : subject;

    await sendEmail(emailSubject, emailBody);

    // Cleanup screenshots after email sent
    cleanupScreenshots();

    log("=== Script Completed ===");

    if (errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    const err = error as Error;
    log(`FATAL ERROR: ${err.message}`, "ERROR");
    log(`Stack trace: ${err.stack}`, "ERROR");
    await sendEmail(
      "Reservation Script Error ❌",
      `Fatal error occurred:\n\n${err.stack}`
    );
    cleanupScreenshots();
    process.exit(1);
  } finally {
    if (browser && !ARGS.watchMode) {
      await browser.close();
    } else if (ARGS.watchMode) {
      log("WATCH MODE: Browser left open for inspection", "DEBUG");
    }
  }
}

// Run the script
main().catch((error) => {
  log(`Unhandled error: ${(error as Error).message}`, "ERROR");
  cleanupScreenshots();
  process.exit(1);
});
