/**
 * Tennis Court Reservation Bot - API Mode
 *
 * Simplified version using mobile API instead of Playwright browser automation
 * 12x faster execution (~0.5s vs ~6.3s)
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

// Load environment
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

// Import utilities
import {
  crMidnight,
  addDaysCR,
  formatDateForUrl,
  getDayOfWeek,
  nowInCR,
  parseDateInCR,
} from "../src/time-cr";
import { MobileAPIClient } from "../src/mobile-api-client";
import { resolveScheduleId } from "../src/schedule-resolver";
import {
  classifyMessage,
  getStatusIcon,
  type MessageType,
} from "../src/message-classifier";
import type { CourtConfig, AppConfig } from "../src/types";

// ============================================================================
// CONFIGURATION (Reuse from existing config)
// ============================================================================

const CONFIG: AppConfig = {
  loginUrl: "https://parquesdelsol.sasweb.net/",
  username: process.env.TENNIS_USERNAME,
  password: process.env.TENNIS_PASSWORD,
  emailTo: process.env.TO_EMAIL_ADDRESS || "stern9@gmail.com",
  emailFrom: process.env.FROM_EMAIL_ADDRESS
    ? `Tennis Reservations <${process.env.FROM_EMAIL_ADDRESS}>`
    : "Tennis Reservations <contact@stern9.dev>",
  resendApiKey: process.env.RESEND_API_KEY,
  courts: {
    court1: {
      areaId: "5",
      name: "Cancha de Tenis 1",
      daysAhead: 9,
      slots: {
        Monday: "06:00 AM - 07:00 AM",
        Wednesday: "06:00 AM - 07:00 AM",
        Friday: "06:00 AM - 07:00 AM",
        Saturday: "09:00 AM - 10:00 AM",
      },
    },
    court2: {
      areaId: "7",
      name: "Cancha de Tenis 2",
      daysAhead: 8,
      slots: {
        Monday: "07:00 AM - 08:00 AM",
        Wednesday: "06:00 AM - 07:00 AM",
        Friday: "07:00 AM - 08:00 AM",
        Saturday: "07:00 AM - 08:00 AM",
      },
    },
  },
};

// ============================================================================
// COMMAND LINE ARGUMENTS
// ============================================================================

interface Args {
  test: boolean;
  targetDate: string | null;
  court1Time: string | null;
  court2Time: string | null;
  skipCourt1: boolean;
  skipCourt2: boolean;
}

const ARGS: Args = {
  test: process.argv.includes("--test"),
  targetDate: getArgValue("--target-date"),
  court1Time: getArgValue("--court1-time"),
  court2Time: getArgValue("--court2-time"),
  skipCourt1: process.argv.includes("--skip-court1"),
  skipCourt2: process.argv.includes("--skip-court2"),
};

function getArgValue(argName: string): string | null {
  const index = process.argv.indexOf(argName);
  return index !== -1 && index + 1 < process.argv.length
    ? process.argv[index + 1]
    : null;
}

// ============================================================================
// LOGGING
// ============================================================================

const LOG_DIR = path.join(__dirname, "..", "..", "logs");
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const LOG_FILE = path.join(
  LOG_DIR,
  `reservation-${new Date().toISOString().split("T")[0]}.log`,
);
const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });

function log(level: string, message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + "\n");
}

// ============================================================================
// MIDNIGHT TIMING
// ============================================================================

async function waitUntilMidnight(): Promise<number | null> {
  if (ARGS.test) {
    log("INFO", "🧪 Test mode: Skipping midnight wait");
    return null;
  }

  log("INFO", "⏰ Waiting for midnight...");

  while (true) {
    const crNow = nowInCR();
    const hours = crNow.getHours();
    const minutes = crNow.getMinutes();
    const seconds = crNow.getSeconds();

    if (hours === 0 && minutes === 0 && seconds === 0) {
      const t0 = Date.now();
      log("INFO", "🕛 Midnight reached! Starting reservation phase...");
      return t0;
    }

    const currentTime = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    log("INFO", `⏰ Waiting for midnight... Current CR time: ${currentTime}`);

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

// ============================================================================
// RESERVATION LOGIC
// ============================================================================

interface ReservationOutcome {
  courtName: string;
  status: MessageType;
  friendlyMessage: string;
  rawMessage: string;
  date?: string;
  time?: string;
  apiCallMs?: number; // API call latency in milliseconds
}

async function reserveCourt(
  client: MobileAPIClient,
  courtConfig: CourtConfig,
  targetDate: Date,
  timeSlot: string,
): Promise<ReservationOutcome> {
  const courtId = courtConfig.areaId as "5" | "7";
  const dayString = formatDateForUrl(targetDate);
  const dayOfWeek = getDayOfWeek(targetDate);

  try {
    // Resolve schedule ID
    const scheduleId = resolveScheduleId(courtId, targetDate, timeSlot);

    log(
      "INFO",
      `📋 ${courtConfig.name}: date=${dayString} (${dayOfWeek}), time=${timeSlot}, schedule=${scheduleId}`,
    );

    // Make API call
    const startTime = Date.now();
    const result = await client.createReservation({
      area: courtId,
      day: dayString,
      schedule: scheduleId,
    });
    const elapsed = Date.now() - startTime;

    log("INFO", `⏱️  ${courtConfig.name}: API call completed in ${elapsed}ms`);

    // Classify the message
    const classified = classifyMessage(result.message);

    if (classified.type === "SUCCESS") {
      log("SUCCESS", `✅ ${courtConfig.name}: ${classified.friendlyMessage}`);
      return {
        courtName: courtConfig.name,
        status: classified.type,
        friendlyMessage: classified.friendlyMessage,
        rawMessage: classified.rawMessage,
        date: dayString,
        time: timeSlot,
        apiCallMs: elapsed,
      };
    } else {
      const icon = getStatusIcon(classified.type);
      log(
        "ERROR",
        `${icon} ${courtConfig.name}: ${classified.type} - ${classified.friendlyMessage}`,
      );
      return {
        courtName: courtConfig.name,
        status: classified.type,
        friendlyMessage: classified.friendlyMessage,
        rawMessage: classified.rawMessage,
        date: dayString,
        time: timeSlot,
        apiCallMs: elapsed,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log("ERROR", `❌ ${courtConfig.name}: Exception - ${errorMessage}`);
    return {
      courtName: courtConfig.name,
      status: "UNKNOWN",
      friendlyMessage: `Unexpected error: ${errorMessage}`,
      rawMessage: errorMessage,
      date: dayString,
      time: timeSlot,
      apiCallMs: 0,
    };
  }
}

// ============================================================================
// EMAIL NOTIFICATIONS
// ============================================================================

function formatDateForEmail(dateString: string): string {
  // Convert YYYY-MM-DD to "Wednesday 17th"
  const date = new Date(dateString + "T00:00:00");
  const dayOfWeek = getDayOfWeek(date);
  const day = date.getDate();

  // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
        ? "nd"
        : day === 3 || day === 23
          ? "rd"
          : "th";

  return `${dayOfWeek} ${day}${suffix}`;
}

function formatMs(ms: number): string {
  // Format milliseconds into human-readable format
  if (ms < 60000) {
    // Under 1 minute: show as seconds (e.g., "0.57s" or "5.23s")
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    // Over 1 minute: show as minutes and seconds (e.g., "1m 30s")
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

async function sendEmailNotification(
  results: ReservationOutcome[],
  t0Time: number | null,
  totalTimeMs: number,
) {
  if (!CONFIG.resendApiKey) {
    log("WARN", "⚠️  No RESEND_API_KEY found, skipping email notification");
    return;
  }

  // Separate successes and errors
  const successes = results.filter((r) => r.status === "SUCCESS");
  const errors = results.filter((r) => r.status !== "SUCCESS");

  // Build email body (matching Playwright format)
  let emailBody = "=== Tennis Court Reservation Summary ===\n\n";

  if (ARGS.test) {
    emailBody += "🧪 TEST MODE:\n";
    emailBody += "(Results may vary from production)\n\n";
  }

  // Success section
  if (successes.length > 0) {
    emailBody += "🎾 REAL BOOKINGS CONFIRMED:\n";
    successes.forEach((r) => {
      const formattedDate = formatDateForEmail(r.date!);
      emailBody += `✅ ${r.courtName} - ${formattedDate} at ${r.time}\n`;
      emailBody += `   Status: ${r.friendlyMessage}\n`;
      if (r.apiCallMs) {
        emailBody += `   📊 API call: ${formatMs(r.apiCallMs)}\n`;
      }
      emailBody += "\n";
    });
  }

  // Error section
  if (errors.length > 0) {
    emailBody += "❌ FAILED RESERVATIONS:\n";
    errors.forEach((r) => {
      const icon = getStatusIcon(r.status);
      const formattedDate = formatDateForEmail(r.date!);
      emailBody += `${icon} ${r.courtName} - ${formattedDate} at ${r.time}\n`;
      emailBody += `   Error: ${r.friendlyMessage}\n`;
      if (r.apiCallMs) {
        emailBody += `   📊 API call: ${formatMs(r.apiCallMs)}\n`;
      }
      emailBody += "\n";
    });
  }

  // Footer
  emailBody += `\n📅 Run time: ${new Date().toISOString()}`;
  if (t0Time) {
    emailBody += `\n⏱️  T0 (midnight): ${new Date(t0Time).toISOString()}`;
  }
  emailBody += `\n⚡ Total execution: ${formatMs(totalTimeMs)}`;
  emailBody += `\n🚀 Mode: API (Mobile App)`;
  emailBody += `\n📄 Log file: ${LOG_FILE}`;

  // Subject (matching Playwright format)
  const subject =
    successes.length > 0 && errors.length === 0
      ? `Reservations Confirmed ✅ (${successes.length}/${successes.length})`
      : successes.length > 0 && errors.length > 0
        ? `Partial Success ⚠️ (${successes.length}/${results.length})`
        : `Reservation Failed ❌`;

  const emailSubject = ARGS.test ? `[TEST] ${subject}` : subject;

  // Send email (using Resend API with HTML formatting)
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.resendApiKey}`,
      },
      body: JSON.stringify({
        from: CONFIG.emailFrom,
        to: [CONFIG.emailTo],
        subject: `🎾 ${emailSubject}`,
        text: emailBody,
        html: `<pre style="font-family: monospace; font-size: 13px;">${emailBody}</pre>`,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      log("INFO", `📧 Email sent successfully (ID: ${data.id})`);
    } else {
      const errorText = await response.text();
      log("ERROR", `📧 Failed to send email: ${response.status} ${errorText}`);
    }
  } catch (error) {
    log("ERROR", `📧 Email error: ${error}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  log("INFO", "=== Tennis Court Reservation Script Started (API Mode) ===");
  log("INFO", `Mode: ${ARGS.test ? "TEST" : "PRODUCTION"}`);

  // Validate credentials
  if (!CONFIG.username || !CONFIG.password) {
    log("ERROR", "❌ Missing credentials (TENNIS_USERNAME or TENNIS_PASSWORD)");
    process.exit(1);
  }

  // Create API client
  const client = new MobileAPIClient(CONFIG.username, CONFIG.password);
  log("INFO", `🔐 API client initialized (user: ${CONFIG.username})`);

  // Wait for midnight (unless in test mode)
  const t0Time = await waitUntilMidnight();

  // Calculate target dates (AFTER midnight to use correct day)
  const today =
    ARGS.test && ARGS.targetDate
      ? parseDateInCR(ARGS.targetDate)
      : crMidnight();

  const court1Date = addDaysCR(today, CONFIG.courts.court1.daysAhead);
  const court2Date = addDaysCR(today, CONFIG.courts.court2.daysAhead);

  const court1DayOfWeek = getDayOfWeek(court1Date);
  const court2DayOfWeek = getDayOfWeek(court2Date);

  // Get time slots
  const court1Time =
    ARGS.court1Time ||
    CONFIG.courts.court1.slots[
      court1DayOfWeek as keyof typeof CONFIG.courts.court1.slots
    ];
  const court2Time =
    ARGS.court2Time ||
    CONFIG.courts.court2.slots[
      court2DayOfWeek as keyof typeof CONFIG.courts.court2.slots
    ];

  log(
    "INFO",
    `📅 Court 1 target: ${formatDateForUrl(court1Date)} (${court1DayOfWeek}) at ${court1Time}`,
  );
  log(
    "INFO",
    `📅 Court 2 target: ${formatDateForUrl(court2Date)} (${court2DayOfWeek}) at ${court2Time}`,
  );

  // Start timer
  const startTime = Date.now();
  log("INFO", "🚀 Starting parallel API reservation calls...");

  // Execute both reservations in parallel
  const reservationPromises: Promise<ReservationOutcome>[] = [];

  if (!ARGS.skipCourt1 && court1Time) {
    reservationPromises.push(
      reserveCourt(client, CONFIG.courts.court1, court1Date, court1Time),
    );
  }

  if (!ARGS.skipCourt2 && court2Time) {
    reservationPromises.push(
      reserveCourt(client, CONFIG.courts.court2, court2Date, court2Time),
    );
  }

  const results = await Promise.all(reservationPromises);

  const totalTime = Date.now() - startTime;
  log("INFO", `⏱️  Total execution time: ${totalTime}ms`);

  // Send email notification
  await sendEmailNotification(results, t0Time, totalTime);

  log("INFO", "=== Script Completed ===");

  // Exit with appropriate code
  const allSuccess = results.every((r) => r.status === "SUCCESS");
  process.exit(allSuccess ? 0 : 1);
}

// Run
main().catch((error) => {
  log("ERROR", `Fatal error: ${error}`);
  process.exit(1);
});
