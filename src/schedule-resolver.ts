/**
 * Schedule ID Resolver
 *
 * Looks up schedule IDs based on court, day of week, and time slot
 * Uses the complete mapping extracted from mobile app API
 */

import {
  COURT1_SCHEDULE_IDS,
  COURT2_SCHEDULE_IDS,
  getDayOfWeekName,
  type DayOfWeek,
} from "../schedule-ids-complete";

/**
 * Resolve schedule ID for a given court, date, and time slot
 *
 * @param courtId - '5' for Court 1, '7' for Court 2
 * @param targetDate - The date to book
 * @param timeSlot - Time slot (e.g., "06:00 AM - 07:00 AM")
 * @returns Schedule ID string (e.g., "241")
 * @throws Error if no schedule ID found
 */
export function resolveScheduleId(
  courtId: "5" | "7",
  targetDate: Date,
  timeSlot: string,
): string {
  const dayName = getDayOfWeekName(targetDate);
  const mapping = courtId === "5" ? COURT1_SCHEDULE_IDS : COURT2_SCHEDULE_IDS;

  const scheduleId = mapping[dayName]?.[timeSlot];

  if (!scheduleId) {
    throw new Error(
      `No schedule ID found for Court ${courtId}, ${dayName}, ${timeSlot}. ` +
        `Available time slots for ${dayName}: ${Object.keys(mapping[dayName] || {}).join(", ")}`,
    );
  }

  return scheduleId;
}

/**
 * Check if a time slot is available for a given court and day
 */
export function isTimeSlotAvailable(
  courtId: "5" | "7",
  dayOfWeek: DayOfWeek,
  timeSlot: string,
): boolean {
  const mapping = courtId === "5" ? COURT1_SCHEDULE_IDS : COURT2_SCHEDULE_IDS;
  return mapping[dayOfWeek]?.[timeSlot] !== undefined;
}

/**
 * Get all available time slots for a court on a given day
 */
export function getAvailableTimeSlots(
  courtId: "5" | "7",
  dayOfWeek: DayOfWeek,
): string[] {
  const mapping = courtId === "5" ? COURT1_SCHEDULE_IDS : COURT2_SCHEDULE_IDS;
  return Object.keys(mapping[dayOfWeek] || {});
}
