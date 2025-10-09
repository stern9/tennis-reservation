/**
 * Costa Rica timezone utilities
 *
 * Provides accurate date/time calculations in Costa Rica timezone (UTC-6, no DST).
 * This fixes the timezone bug where the script was using system local time instead
 * of Costa Rica time, causing it to target dates 1 day too far ahead.
 */

export const CR_TZ = "America/Costa_Rica";

/**
 * Get current time in Costa Rica timezone
 */
export function nowInCR(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: CR_TZ }));
}

/**
 * Get midnight (00:00:00) in Costa Rica timezone for "today"
 * This is the corrected version that should be used instead of:
 *   const today = new Date(); today.setHours(0, 0, 0, 0);
 */
export function crMidnight(): Date {
  const d = nowInCR();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Add days to a date (preserves time)
 */
export function addDaysCR(base: Date, days: number): Date {
  const result = new Date(base);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Format date as YYYY-MM-DD
 */
export function ymdCR(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format date for URL parameter (used by the website)
 * Format: YYYY-M-D (no padding)
 */
export function formatDateForUrl(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${month}-${day}`;
}

/**
 * Get day of week name
 */
export function getDayOfWeek(date: Date): string {
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
