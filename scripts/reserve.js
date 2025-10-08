const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
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
        Tuesday: "06:00 AM - 07:00 AM",
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

const ARGS = {
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
};

function getArgValue(argName) {
  const index = process.argv.indexOf(argName);
  return index !== -1 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : null;
}

// ============================================================================
// LOGGING SETUP
// ============================================================================

const logDir = path.join(__dirname, "..", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(
  logDir,
  `reservation-${new Date().toISOString().split("T")[0]}.log`
);

function log(message, level = "INFO") {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(logFile, logMessage + "\n");
}

// ============================================================================
// SCREENSHOT UTILITIES
// ============================================================================

const screenshotDir = path.join(__dirname, "..", "screenshots");
let currentScreenshotSession = null;

function initScreenshotSession() {
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

async function takeScreenshot(page, name) {
  if (!ARGS.debugMode || !currentScreenshotSession) return;

  try {
    const filepath = path.join(currentScreenshotSession, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: true });
    log(`Screenshot saved: ${name}.png`, "DEBUG");
  } catch (error) {
    log(`Failed to take screenshot ${name}: ${error.message}`, "WARN");
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
    log(`Failed to cleanup screenshots: ${error.message}`, "WARN");
  }
}

// ============================================================================
// DATE & TIME UTILITIES
// ============================================================================

function getCostaRicaTime() {
  // Costa Rica is UTC-6 (no DST)
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const costaRicaTime = new Date(utc + -6 * 3600000);
  return costaRicaTime;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDayOfWeek(date) {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  return days[date.getDay()];
}

function formatDateForUrl(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month}-${day}`;
}

function waitUntilMidnight() {
  return new Promise((resolve) => {
    const checkMidnight = () => {
      const crTime = getCostaRicaTime();
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

// ============================================================================
// EMAIL NOTIFICATION
// ============================================================================

async function sendEmail(subject, body, attachScreenshots = false) {
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
    log(`Failed to send email: ${error.message}`, "ERROR");
  }
}

// ============================================================================
// PHASE 1: LOGIN (at 11:58pm)
// ============================================================================

async function loginPhase(browser) {
  const page = await browser.newPage();

  try {
    log("🔐 Phase 1: Logging in...");

    await page.goto(CONFIG.loginUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await takeScreenshot(page, "1-login-page");

    // Find and fill login form
    const usernameInput = await page.$('input[type="text"]');
    const passwordInput = await page.$('input[type="password"]');

    if (!usernameInput || !passwordInput) {
      const allInputs = await page.$$("input");
      log(`Found ${allInputs.length} input fields on login page`);

      if (allInputs.length >= 2) {
        await allInputs[0].type(String(CONFIG.username));
        await allInputs[1].type(String(CONFIG.password));
      } else {
        throw new Error("Could not find login form inputs");
      }
    } else {
      await usernameInput.type(String(CONFIG.username));
      await passwordInput.type(String(CONFIG.password));
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
    throw new Error(`Login failed: ${error.message}`);
  }
}

// ============================================================================
// PHASE 2: RESERVE (at 12:00am or immediately in test mode)
// ============================================================================

async function reservePhase(page, courtConfig, targetDate, timeSlot) {
  try {
    log(
      `🎾 Phase 2: Reserving ${
        courtConfig.name
      } on ${targetDate.toDateString()} at ${timeSlot}`
    );

    // Navigate to reservations
    log("Opening reservations modal...");
    await page.evaluate(() => {
      const link = document.querySelector('a[href="pre_reservations.php"]');
      if (link) link.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Select area in iframe
    log(`Selecting ${courtConfig.name}...`);
    await page.waitForSelector("iframe", { timeout: 10000 });

    const frames = page.frames();
    const frame = frames.find((f) => f.url().includes("pre_reservations.php"));

    if (!frame) {
      throw new Error("Could not find reservations iframe");
    }

    await takeScreenshot(page, "3-reservations-modal");

    await frame.waitForSelector("#area", { timeout: 10000 });
    await frame.select("#area", courtConfig.areaId);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await frame.waitForSelector("input#btn_cont", { timeout: 5000 });
    await frame.click("input#btn_cont");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Click on date in calendar
    log(`Selecting date: ${formatDateForUrl(targetDate)}...`);

    const calendarFrame = frames.find((f) =>
      f.url().includes("reservations.php")
    );
    if (!calendarFrame) {
      throw new Error("Could not find calendar iframe");
    }

    await takeScreenshot(page, "4-calendar-view");

    const formattedDate = formatDateForUrl(targetDate);

    // Check if date is clickable
    const dateStatus = await calendarFrame.evaluate((dateStr) => {
      const clickableCell = document.querySelector(
        `td.calendar-day_clickable[onclick*="${dateStr}"]`
      );
      if (clickableCell) return "clickable";

      const anyCell = Array.from(document.querySelectorAll("td")).find((td) =>
        td.getAttribute("onclick")?.includes(dateStr)
      );
      if (anyCell) return "not_clickable";

      return "not_found";
    }, formattedDate);

    if (dateStatus === "not_found") {
      throw new Error(
        `DATE_NOT_AVAILABLE: Date ${targetDate.toDateString()} not found in calendar - may not be within booking window yet`
      );
    }

    if (dateStatus === "not_clickable") {
      // Click on it anyway to get the error message
      const dateSelector = `td[onclick*="${formattedDate}"]`;
      await calendarFrame.click(dateSelector);
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check for the "not available yet" message
      const allFrames = page.frames();
      let notAvailableMessage = null;

      for (const f of allFrames) {
        try {
          const bodyText = await Promise.race([
            f.evaluate(() => document.body.innerText),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Frame read timeout")), 2000)
            ),
          ]);

          // Check for "not available yet" message in Spanish
          if (bodyText.includes("aún no está disponible para reservación")) {
            // Extract the number of days from the message
            const daysMatch = bodyText.match(/(\d+)\s+días?\s+antes/);
            const daysAhead = daysMatch ? daysMatch[1] : "X";
            notAvailableMessage = `Date not available yet - reservations open ${daysAhead} days in advance`;
            break;
          }
        } catch (e) {
          // Skip frames we can't access
        }
      }

      if (notAvailableMessage) {
        throw new Error(`DATE_NOT_AVAILABLE_YET: ${notAvailableMessage}`);
      } else {
        throw new Error(
          `DATE_NOT_CLICKABLE: Date ${targetDate.toDateString()} is in calendar but not clickable - may be fully booked`
        );
      }
    }

    log("Date is clickable, proceeding...");
    const dateSelector = `td.calendar-day_clickable[onclick*="${formattedDate}"]`;
    await calendarFrame.click(dateSelector);

    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Navigate to nested iframe and request reservation
    log("Opening reservation form...");

    const allFrames = page.frames();
    let reservationFrame = null;

    for (const f of allFrames) {
      const url = f.url();
      if (
        url.includes("reservations.php") &&
        !url.includes("pre_reservations")
      ) {
        const content = await f.content();
        if (content.includes("Solicitar Reserva")) {
          reservationFrame = f;
          break;
        }
      }
    }

    if (!reservationFrame) {
      for (const f of allFrames) {
        try {
          const content = await f.content();
          if (content.includes("Solicitar Reserva")) {
            reservationFrame = f;
            break;
          }
        } catch (e) {
          // Skip frames we can't access
        }
      }
    }

    if (!reservationFrame) {
      throw new Error("Could not find day view iframe");
    }

    await takeScreenshot(page, "5-day-view");

    await reservationFrame.waitForSelector('a[href*="new_reservation.php"]', {
      timeout: 5000,
    });

    await reservationFrame.evaluate(() => {
      const link = document.querySelector('a[href*="new_reservation.php"]');
      if (link) link.click();
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Fill and submit reservation form
    log(`Selecting time slot: ${timeSlot}...`);

    let formFrame = null;
    for (const f of page.frames()) {
      const url = f.url();
      if (url.includes("new_reservation.php")) {
        formFrame = f;
        break;
      }
    }

    if (!formFrame) {
      throw new Error("Could not find reservation form iframe");
    }

    await formFrame.waitForSelector("#schedule", { timeout: 5000 });

    // Select time slot by visible text
    const selected = await formFrame.evaluate((targetSlot) => {
      const select = document.getElementById("schedule");
      const [startTime, endTime] = targetSlot.split(" - ");

      for (let i = 0; i < select.options.length; i++) {
        const option = select.options[i];
        if (option.text.includes(startTime) && option.text.includes(endTime)) {
          select.selectedIndex = i;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          return option.text;
        }
      }
      return null;
    }, timeSlot);

    if (!selected) {
      throw new Error(
        `TIME_SLOT_NOT_FOUND: Could not find time slot: ${timeSlot}`
      );
    }

    await takeScreenshot(page, "6-form-filled");

    log("Submitting reservation...");

    // In watch mode, pause before submitting
    if (ARGS.watchMode) {
      log(
        "WATCH MODE: Pausing 5 seconds before submission. Browser will stay open.",
        "DEBUG"
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    // Click submit button
    await formFrame.evaluate(() => {
      setTimeout(() => {
        const btn = document.getElementById("save_btn");
        if (btn) btn.click();
      }, 0);
    });

    // Wait for response
    await new Promise((resolve) => setTimeout(resolve, 4000));

    await takeScreenshot(page, "7-submission-result");

    // Check for success or error
    let successFound = false;
    let errorMessage = null;

    for (const frame of page.frames()) {
      try {
        const bodyText = await Promise.race([
          frame.evaluate(() => document.body.innerText),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Frame read timeout")), 2000)
          ),
        ]);

        // Check for success
        if (
          bodyText.includes("se ha realizado con éxito") ||
          bodyText.includes("aprobada") ||
          (bodyText.includes("reservación") && bodyText.includes("éxito"))
        ) {
          successFound = true;
          break;
        }

        // Check for errors
        if (
          bodyText.includes("sobrepasado el limite") ||
          bodyText.includes("límite permitido")
        ) {
          errorMessage =
            "RESERVATION_LIMIT: Reservation limit exceeded - you have already used your allowed reservations";
        } else if (bodyText.includes("excede la cantidad máxima de personas")) {
          errorMessage =
            "SLOT_TAKEN: Time slot already taken - someone else reserved it first";
        } else if (
          bodyText.includes("ocupado") ||
          bodyText.includes("no disponible")
        ) {
          errorMessage =
            "SLOT_OCCUPIED: Time slot is occupied or not available";
        }
      } catch (e) {
        // Skip frames we can't access
      }
    }

    if (successFound) {
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
      };
    } else if (errorMessage) {
      throw new Error(errorMessage);
    } else {
      throw new Error(
        "UNKNOWN_ERROR: Could not confirm reservation success - no success message found"
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

async function main() {
  log("=== Tennis Court Reservation Script Started ===");
  log(
    `Mode: ${ARGS.test ? "TEST" : "PRODUCTION"}${
      ARGS.dryRun ? " (DRY RUN)" : ""
    }${ARGS.debugMode ? " (DEBUG)" : ""}`
  );

  const results = [];
  const errors = [];
  let browser;

  try {
    // Initialize screenshot session if in debug mode
    initScreenshotSession();

    // Calculate target dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let targetDateCourt1, targetDateCourt2;

    if (ARGS.test && ARGS.targetDate) {
      // Test mode with specific date
      const [year, month, day] = ARGS.targetDate.split("-").map(Number);
      targetDateCourt1 = new Date(year, month - 1, day);
      targetDateCourt2 = new Date(year, month - 1, day);
      log(`TEST MODE: Using date ${ARGS.targetDate}`);
    } else if (!ARGS.test) {
      // Production mode: calculate rolling window
      targetDateCourt1 = addDays(today, CONFIG.courts.court1.daysAhead);
      targetDateCourt2 = addDays(today, CONFIG.courts.court2.daysAhead);
    } else {
      log("ERROR: Test mode requires --target-date parameter", "ERROR");
      process.exit(1);
    }

    const dayOfWeek1 = getDayOfWeek(targetDateCourt1);
    const dayOfWeek2 = getDayOfWeek(targetDateCourt2);

    log(`Today: ${today.toDateString()}`);
    log(`Court 1 target: ${targetDateCourt1.toDateString()} (${dayOfWeek1})`);
    log(`Court 2 target: ${targetDateCourt2.toDateString()} (${dayOfWeek2})`);

    // Check if we need to make reservations
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

    // Launch browser
    const launchOptions = {
      headless: !ARGS.watchMode,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };

    if (!ARGS.watchMode) {
      launchOptions.args.push("--disable-dev-shm-usage", "--disable-gpu");
    }

    browser = await puppeteer.launch(launchOptions);

    // PHASE 1: Login (at 11:58pm in production, immediate in test mode)
    const loginPage = await loginPhase(browser);

    // Wait for midnight if not in test mode
    if (!ARGS.test) {
      const crTime = getCostaRicaTime();
      log(`Current Costa Rica time: ${crTime.toLocaleTimeString()}`);

      if (crTime.getHours() !== 0 || crTime.getMinutes() !== 0) {
        log("Waiting for midnight Costa Rica time...");
        await waitUntilMidnight();
      } else {
        log("Already midnight, proceeding immediately");
      }
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
    if (shouldReserveCourt1) {
      log("--- Starting Court 1 Reservation ---");
      try {
        const result = await reservePhase(
          loginPage,
          CONFIG.courts.court1,
          targetDateCourt1,
          court1TimeSlot
        );
        results.push(result);
      } catch (error) {
        errors.push({
          court: "Court 1",
          error: error.message,
        });
      }
    }

    if (shouldReserveCourt2) {
      log("--- Starting Court 2 Reservation ---");
      // Need fresh login for second court
      const loginPage2 = await loginPhase(browser);

      try {
        const result = await reservePhase(
          loginPage2,
          CONFIG.courts.court2,
          targetDateCourt2,
          court2TimeSlot
        );
        results.push(result);
      } catch (error) {
        errors.push({
          court: "Court 2",
          error: error.message,
        });
      }
    }

    // Send summary email
    let emailBody = "=== Tennis Court Reservation Summary ===\n\n";

    if (results.length > 0) {
      emailBody += "SUCCESSFUL RESERVATIONS:\n";
      results.forEach((r) => {
        emailBody += `✅ ${r.court} - ${r.date} at ${r.time}\n`;
      });
      emailBody += "\n";
    }

    if (errors.length > 0) {
      emailBody += "FAILED RESERVATIONS:\n";
      errors.forEach((e) => {
        emailBody += `❌ ${e.court} - ${e.error}\n`;
      });
      emailBody += "\n";
    }

    emailBody += `\nRun time: ${new Date().toISOString()}`;
    emailBody += `\nLog file: ${logFile}`;

    const subject =
      results.length > 0 && errors.length === 0
        ? `Reservations Confirmed ✅ (${results.length}/${results.length})`
        : results.length > 0 && errors.length > 0
        ? `Partial Success ⚠️ (${results.length}/${
            results.length + errors.length
          })`
        : `Reservation Failed ❌`;

    await sendEmail(subject, emailBody);

    // Cleanup screenshots after email sent
    cleanupScreenshots();

    log("=== Script Completed ===");

    if (errors.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    log(`FATAL ERROR: ${error.message}`, "ERROR");
    log(`Stack trace: ${error.stack}`, "ERROR");
    await sendEmail(
      "Reservation Script Error ❌",
      `Fatal error occurred:\n\n${error.stack}`
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
  log(`Unhandled error: ${error.message}`, "ERROR");
  cleanupScreenshots();
  process.exit(1);
});
