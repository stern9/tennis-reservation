/**
 * Complete Schedule ID Mapping for SAS Condominios Mobile App
 *
 * Extracted from: fn=reservations_form response
 * Date: November 10, 2025
 *
 * IMPORTANT: Schedule IDs are specific to:
 * - Court (area ID)
 * - Day of week (0=Sunday, 6=Saturday)
 * - Time slot
 *
 * These IDs are DIFFERENT from the web version!
 */

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
export type TimeSlot = string; // Format: "HH:MM AM - HH:MM AM"

export interface ScheduleMapping {
  [dayOfWeek: string]: {
    [timeSlot: string]: string; // schedule ID
  };
}

/**
 * Court 1 (Area 5) Schedule IDs
 */
export const COURT1_SCHEDULE_IDS: ScheduleMapping = {
  Monday: {
    "06:00 AM - 07:00 AM": "239",
    "07:00 AM - 08:00 AM": "246",
    "08:00 AM - 09:00 AM": "253",
    "09:00 AM - 10:00 AM": "260",
    "10:00 AM - 11:00 AM": "267",
    "11:00 AM - 12:00 PM": "274",
    "12:00 PM - 01:00 PM": "281",
    "01:00 PM - 02:00 PM": "288",
    "02:00 PM - 03:00 PM": "295",
    "03:00 PM - 04:00 PM": "302",
    "04:00 PM - 05:00 PM": "309",
    "05:00 PM - 06:00 PM": "316",
    "06:00 PM - 07:00 PM": "323",
  },
  Tuesday: {
    "06:00 AM - 07:00 AM": "240",
    "07:00 AM - 08:00 AM": "247",
    "08:00 AM - 09:00 AM": "254",
    "09:00 AM - 10:00 AM": "261",
    "10:00 AM - 11:00 AM": "268",
    "11:00 AM - 12:00 PM": "275",
    "12:00 PM - 01:00 PM": "282",
    "01:00 PM - 02:00 PM": "289",
    "02:00 PM - 03:00 PM": "296",
    "03:00 PM - 04:00 PM": "303",
    "04:00 PM - 05:00 PM": "310",
    "05:00 PM - 06:00 PM": "317",
    "06:00 PM - 07:00 PM": "324",
  },
  Wednesday: {
    "06:00 AM - 07:00 AM": "241", // ✓ Verified
    "07:00 AM - 08:00 AM": "248",
    "08:00 AM - 09:00 AM": "255", // ✓ Verified
    "09:00 AM - 10:00 AM": "262",
    "10:00 AM - 11:00 AM": "269",
    "11:00 AM - 12:00 PM": "276",
    "12:00 PM - 01:00 PM": "283",
    "01:00 PM - 02:00 PM": "290",
    "02:00 PM - 03:00 PM": "297",
    "03:00 PM - 04:00 PM": "304",
    "04:00 PM - 05:00 PM": "311",
    "05:00 PM - 06:00 PM": "318", // ✓ Verified
    "06:00 PM - 07:00 PM": "325",
  },
  Thursday: {
    "06:00 AM - 07:00 AM": "242",
    "07:00 AM - 08:00 AM": "249",
    "08:00 AM - 09:00 AM": "256",
    "09:00 AM - 10:00 AM": "263",
    "10:00 AM - 11:00 AM": "270",
    "11:00 AM - 12:00 PM": "277",
    "12:00 PM - 01:00 PM": "284",
    "01:00 PM - 02:00 PM": "291",
    "02:00 PM - 03:00 PM": "298",
    "03:00 PM - 04:00 PM": "305",
    "04:00 PM - 05:00 PM": "312",
    "05:00 PM - 06:00 PM": "319",
    "06:00 PM - 07:00 PM": "326",
  },
  Friday: {
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
  },
  Saturday: {
    "06:00 AM - 07:00 AM": "244",
    "07:00 AM - 08:00 AM": "251",
    "08:00 AM - 09:00 AM": "258",
    "09:00 AM - 10:00 AM": "265",
    "10:00 AM - 11:00 AM": "272",
    "11:00 AM - 12:00 PM": "279",
    "12:00 PM - 01:00 PM": "286",
    "01:00 PM - 02:00 PM": "293",
    "02:00 PM - 03:00 PM": "300",
    "03:00 PM - 04:00 PM": "307",
    "04:00 PM - 05:00 PM": "314",
    "05:00 PM - 06:00 PM": "321",
    "06:00 PM - 07:00 PM": "328",
  },
  Sunday: {
    "06:00 AM - 07:00 AM": "245",
    "07:00 AM - 08:00 AM": "252",
    "08:00 AM - 09:00 AM": "259",
    "09:00 AM - 10:00 AM": "266",
    "10:00 AM - 11:00 AM": "273",
    "11:00 AM - 12:00 PM": "280",
    "12:00 PM - 01:00 PM": "287",
    "01:00 PM - 02:00 PM": "294",
    "02:00 PM - 03:00 PM": "301",
    "03:00 PM - 04:00 PM": "308",
    "04:00 PM - 05:00 PM": "315",
    "05:00 PM - 06:00 PM": "322",
    "06:00 PM - 07:00 PM": "329",
  },
};

/**
 * Court 2 (Area 7) Schedule IDs
 */
export const COURT2_SCHEDULE_IDS: ScheduleMapping = {
  Monday: {
    "06:00 AM - 07:00 AM": "337",
    "07:00 AM - 08:00 AM": "344",
    "08:00 AM - 09:00 AM": "351",
    "09:00 AM - 10:00 AM": "358",
    "10:00 AM - 11:00 AM": "365",
    "11:00 AM - 12:00 PM": "372",
    "12:00 PM - 01:00 PM": "379",
    "01:00 PM - 02:00 PM": "386",
    "02:00 PM - 03:00 PM": "393",
    "03:00 PM - 04:00 PM": "400",
    "04:00 PM - 05:00 PM": "407",
    "05:00 PM - 06:00 PM": "1141",
    "06:00 PM - 07:00 PM": "414",
  },
  Tuesday: {
    "06:00 AM - 07:00 AM": "338",
    "07:00 AM - 08:00 AM": "345",
    "08:00 AM - 09:00 AM": "352", // ✓ Verified
    "09:00 AM - 10:00 AM": "359",
    "10:00 AM - 11:00 AM": "366",
    "11:00 AM - 12:00 PM": "373",
    "12:00 PM - 01:00 PM": "380",
    "01:00 PM - 02:00 PM": "387",
    "02:00 PM - 03:00 PM": "394",
    "03:00 PM - 04:00 PM": "401",
    "04:00 PM - 05:00 PM": "408",
    "05:00 PM - 06:00 PM": "1142",
    "06:00 PM - 07:00 PM": "415",
  },
  Wednesday: {
    "06:00 AM - 07:00 AM": "339",
    "07:00 AM - 08:00 AM": "346",
    "08:00 AM - 09:00 AM": "353",
    "09:00 AM - 10:00 AM": "360",
    "10:00 AM - 11:00 AM": "367",
    "11:00 AM - 12:00 PM": "374",
    "12:00 PM - 01:00 PM": "381",
    "01:00 PM - 02:00 PM": "388",
    "02:00 PM - 03:00 PM": "395",
    "03:00 PM - 04:00 PM": "402",
    "04:00 PM - 05:00 PM": "409",
    "05:00 PM - 06:00 PM": "1143",
    "06:00 PM - 07:00 PM": "416",
  },
  Thursday: {
    "06:00 AM - 07:00 AM": "340",
    "07:00 AM - 08:00 AM": "347",
    "08:00 AM - 09:00 AM": "354",
    "09:00 AM - 10:00 AM": "361",
    "10:00 AM - 11:00 AM": "368",
    "11:00 AM - 12:00 PM": "375",
    "12:00 PM - 01:00 PM": "382",
    "01:00 PM - 02:00 PM": "389",
    "02:00 PM - 03:00 PM": "396",
    "03:00 PM - 04:00 PM": "403",
    "04:00 PM - 05:00 PM": "410",
    "05:00 PM - 06:00 PM": "1144",
    "06:00 PM - 07:00 PM": "417",
  },
  Friday: {
    "06:00 AM - 07:00 AM": "341",
    "07:00 AM - 08:00 AM": "348",
    "08:00 AM - 09:00 AM": "355",
    "09:00 AM - 10:00 AM": "362",
    "10:00 AM - 11:00 AM": "369",
    "11:00 AM - 12:00 PM": "376",
    "12:00 PM - 01:00 PM": "383",
    "01:00 PM - 02:00 PM": "390",
    "02:00 PM - 03:00 PM": "397",
    "03:00 PM - 04:00 PM": "404",
    "04:00 PM - 05:00 PM": "411",
    "05:00 PM - 06:00 PM": "1145",
    "06:00 PM - 07:00 PM": "418",
  },
  Saturday: {
    "06:00 AM - 07:00 AM": "342",
    "07:00 AM - 08:00 AM": "349",
    "08:00 AM - 09:00 AM": "356",
    "09:00 AM - 10:00 AM": "363",
    "10:00 AM - 11:00 AM": "370",
    "11:00 AM - 12:00 PM": "377",
    "12:00 PM - 01:00 PM": "384",
    "01:00 PM - 02:00 PM": "391",
    "02:00 PM - 03:00 PM": "398",
    "03:00 PM - 04:00 PM": "405",
    "04:00 PM - 05:00 PM": "412",
    "05:00 PM - 06:00 PM": "1146",
    "06:00 PM - 07:00 PM": "419",
  },
  Sunday: {
    "06:00 AM - 07:00 AM": "343",
    "07:00 AM - 08:00 AM": "350",
    "08:00 AM - 09:00 AM": "357",
    "09:00 AM - 10:00 AM": "364", // ✓ Verified
    "10:00 AM - 11:00 AM": "371",
    "11:00 AM - 12:00 PM": "378",
    "12:00 PM - 01:00 PM": "385",
    "01:00 PM - 02:00 PM": "392",
    "02:00 PM - 03:00 PM": "399",
    "03:00 PM - 04:00 PM": "406",
    "04:00 PM - 05:00 PM": "413",
    "05:00 PM - 06:00 PM": "1147",
    "06:00 PM - 07:00 PM": "420",
  },
};

/**
 * Helper function to get schedule ID for a court, day, and time
 */
export function getScheduleId(
  courtId: '5' | '7',
  dayOfWeek: DayOfWeek,
  timeSlot: TimeSlot
): string | undefined {
  const mapping = courtId === '5' ? COURT1_SCHEDULE_IDS : COURT2_SCHEDULE_IDS;
  return mapping[dayOfWeek]?.[timeSlot];
}

/**
 * Helper function to get day of week name from Date object
 */
export function getDayOfWeekName(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

/**
 * Example usage:
 *
 * const targetDate = new Date('2025-11-19'); // Wednesday
 * const dayName = getDayOfWeekName(targetDate); // "Wednesday"
 * const scheduleId = getScheduleId('5', dayName, "06:00 AM - 07:00 AM"); // "241"
 */
