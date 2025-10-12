/**
 * Enhanced error detection for tennis reservation system
 *
 * Provides robust iframe scanning and message classification based on
 * the <!--APP::...::APP--> comment markers used by the SASWeb system.
 */

import type { Page, Frame } from "puppeteer";
import type { ErrorResult, FrameData } from "./types";
import * as fs from "fs";
import * as path from "path";

/**
 * Wait for the reservation result iframe to load
 * This replaces fixed setTimeout delays with event-driven waiting
 */
export async function waitForReservationIframe(
  page: Page,
  options: { timeout?: number } = {}
): Promise<Frame> {
  const { timeout = 12000 } = options;

  // Wait until the reservation response iframe appears
  // It can be either display_reservation.php (date clicks) or add_reservation.php (form submissions)
  const responseFramePattern = /(display_reservation|add_reservation)\.php/;

  await page.waitForFrame((f) => responseFramePattern.test(f.url()), {
    timeout,
  });

  const frame = page.frames().find((f) => responseFramePattern.test(f.url()));
  if (!frame) {
    throw new Error("Reservation response iframe not found after wait");
  }

  // Wait for DOM to be ready
  await frame
    .waitForFunction(() => document.readyState === "complete", { timeout: 3000 })
    .catch(() => {});

  // Small delay to ensure content is loaded (don't wait for APP marker as it's not always present)
  await new Promise((resolve) => setTimeout(resolve, 500));

  return frame;
}

/**
 * Get text content from all frames (for debugging)
 */
export async function getAllFramesText(page: Page): Promise<FrameData[]> {
  const allText: FrameData[] = [];
  const allFrames = page.frames();

  for (const frame of allFrames) {
    try {
      const data = await Promise.race<FrameData>([
        frame.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          bodyText: document.body.innerText,
          innerHTMLSnippet: document.body.innerHTML.substring(0, 5000),
        })),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 3000)
        ),
      ]);
      allText.push(data);
    } catch (e) {
      // Frame not accessible or timed out
    }
  }

  return allText;
}

/**
 * Dump frame content to file for debugging
 */
export async function dumpFrameContent(
  frame: Frame,
  filename: string
): Promise<void> {
  try {
    const html = await frame.content();
    const text = await frame.evaluate(() => document.body.innerText);
    const output = `=== FRAME DUMP ===\nURL: ${frame.url()}\n\n=== HTML ===\n${html}\n\n=== TEXT ===\n${text}`;
    fs.writeFileSync(filename, output, "utf-8");
  } catch (error) {
    console.error(`Failed to dump frame content: ${error}`);
  }
}

/**
 * Dump all frames content for comprehensive debugging
 */
export async function dumpAllFrames(
  page: Page,
  filename: string
): Promise<void> {
  const framesData = await getAllFramesText(page);
  const output = framesData
    .map(
      (f, i) =>
        `=== FRAME ${i} ===\nURL: ${f.url}\nTitle: ${f.title}\n\n${f.bodyText}\n\n`
    )
    .join("\n");

  fs.writeFileSync(filename, output, "utf-8");
}

/**
 * Detect and classify error/success messages from the reservation iframe
 *
 * Uses the <!--APP::...::APP--> comment marker as the primary signal,
 * which is more reliable than parsing visible HTML.
 */
export async function detectError(frame: Frame): Promise<ErrorResult> {
  const html = await frame.content();

  // Extract canonical message from APP comment marker
  const appMatch = html.match(/<!--APP::(.*?)::APP-->/s);
  const canonicalMessage = appMatch ? appMatch[1].trim() : null;

  // If no APP marker, fallback to body text parsing
  // This handles display_reservation.php which doesn't use APP markers
  const messageToCheck = canonicalMessage || (await frame
    .evaluate(() => document.body.innerText.trim())
    .catch(() => ""));

  if (!messageToCheck) {
    return {
      type: "UNKNOWN",
      message: "No response content found",
      rawMessage: "",
      frameUrl: frame.url(),
    };
  }

  // Normalize message for robust pattern matching (remove diacritics, collapse whitespace)
  const msg = messageToCheck
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/\s+/g, " ");

  // Pattern 1: Date not available yet (too far ahead)
  // Examples observed or likely variants:
  //  - "Esta fecha aún no está disponible para reservación. Las reservaciones serán habilitadas 8 días antes."
  //  - "Esta fecha aun no esta disponible para reservacion."
  //  - "Fecha no se encuentra habilitada para reservación"
  //  - "Las reservaciones seran habilitadas 9 dias antes"
  // NOTE: Website bug - shows "8 dias" for Court 1 (should be 9), "7 dias" for Court 2 (should be 8)
  if (
    (
      /aun\s+no\s+esta\s+disponible/.test(msg) ||
      /no\s+(esta|se\s+encuentra)\s+(disponible|habilitada)/.test(msg)
    ) && /(reservacion|reservaciones)/.test(msg)
  ) {
    const daysMatch = msg.match(/(\d+)\s+dias?\s+(antes|previo|previos)/);
    return {
      type: "NOT_YET_AVAILABLE",
      message: "Not available yet",
      days: daysMatch?.[1],
      rawMessage: messageToCheck,
      frameUrl: frame.url(),
    };
  }

  // Pattern 2: Slot already taken (area capacity hit by others - race condition)
  // Example: "Su reservación excede la cantidad máxima... ya existen otras reservaciones"
  if (
    /(ya\s+existen\s+otras\s+reservaciones|excede\s+la\s+cantidad\s+maxima)/.test(msg)
  ) {
    return {
      type: "SLOT_TAKEN",
      message: "Time slot already taken - someone else reserved it first",
      rawMessage: messageToCheck,
      frameUrl: frame.url(),
    };
  }

  // Pattern 3: Reservation limit exceeded (user quota reached)
  // Example: "No es posible ingresar la reservación, usted ya há sobrepasado el limite permitido"
  if (
    /(ya\s*ha\s*sobrepasado.*limite|sobrepasado.*limite\s+permitido)/.test(msg)
  ) {
    return {
      type: "RESERVATION_LIMIT",
      message:
        "Reservation limit exceeded - you have already used your allowed reservations",
      rawMessage: messageToCheck,
      frameUrl: frame.url(),
    };
  }

  // Pattern 4: Success
  // Example: "Su reservación se ha realizado con éxito y ya se encuentra aprobada."
  if (/se\s+ha\s+realizado.*exito/.test(msg)) {
    return {
      type: "SUCCESS",
      message: "Reservation successful",
      rawMessage: messageToCheck,
      frameUrl: frame.url(),
    };
  }

  // Unknown - return raw message for manual inspection
  return {
    type: "UNKNOWN",
    message: "Could not classify response",
    rawMessage: messageToCheck,
    frameUrl: frame.url(),
  };
}

/**
 * Verify booking appears on history page
 * @param page - Puppeteer page object (should be at my_reservations.php)
 * @param dateISO - Date in YYYY-MM-DD format
 * @param time - Time string (e.g., "06:00" or "6:00")
 * @param area - Court area name (e.g., "Cancha de Tenis 1")
 */
export async function verifyBookingOnHistoryPage(
  page: Page,
  dateISO: string,
  time: string,
  area: string
): Promise<boolean> {
  try {
    const pageText = await page.evaluate(() =>
      document.body.innerText.toLowerCase()
    );

    // Normalize search terms
    const normalizedDate = dateISO.toLowerCase();
    const normalizedTime = time.replace(/^0/, ""); // Handle both "06:00" and "6:00"
    const normalizedArea = area.toLowerCase();

    // Check if date, time, and area all appear on the page
    const dateFound =
      pageText.includes(normalizedDate) ||
      pageText.includes(normalizedDate.replace(/-/g, "/"));
    const timeFound =
      pageText.includes(time.toLowerCase()) ||
      pageText.includes(normalizedTime.toLowerCase());
    const areaFound = pageText.includes(normalizedArea);

    return dateFound && timeFound && areaFound;
  } catch (error) {
    console.error(`Failed to verify booking on history page: ${error}`);
    return false;
  }
}
