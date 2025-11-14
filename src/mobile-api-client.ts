/**
 * Mobile API Client for SAS Condominios
 *
 * Reverse-engineered from the mobile app (Nov 2025)
 * Uses direct API endpoints instead of browser automation
 */

import crypto from "crypto";

export interface ReservationParams {
  area: "5" | "7"; // 5 = Court 1, 7 = Court 2
  day: string; // Format: YYYY-MM-DD
  schedule: string; // Schedule ID (e.g., "241")
}

export interface ReservationResult {
  success: boolean;
  message: string;
  rawResponse: any;
}

export class MobileAPIClient {
  private username: string;
  private passwordHash: string;
  private baseUrl = "https://www.sasweb.net/utilities/process/app/poster.php";

  constructor(
    username: string,
    password: string,
    isPreHashed: boolean = false,
  ) {
    this.username = username;
    // MD5 hash the password (matches mobile app implementation)
    // If already hashed (32 char hex string), use directly
    if (
      isPreHashed ||
      (password.length === 32 && /^[a-f0-9]+$/i.test(password))
    ) {
      this.passwordHash = password.toLowerCase();
    } else {
      this.passwordHash = crypto
        .createHash("md5")
        .update(password)
        .digest("hex");
    }
  }

  /**
   * Create a tennis court reservation
   */
  async createReservation(
    params: ReservationParams,
  ): Promise<ReservationResult> {
    const url = this.buildReservationUrl(params);

    console.log(
      `[API] Calling: area=${params.area}, day=${params.day}, schedule=${params.schedule}`,
    );

    try {
      const response = await fetch(url);
      const text = await response.text();

      return this.parseJSONPResponse(text);
    } catch (error) {
      console.error("[API] Request failed:", error);
      throw new Error(`API request failed: ${error}`);
    }
  }

  /**
   * Build the full API URL with all parameters
   */
  private buildReservationUrl(params: ReservationParams): string {
    const queryParams = new URLSearchParams({
      lang: "null",
      condo: "16", // Parques del Sol
      app_user: this.username,
      app_password: this.passwordHash,
      area: params.area,
      day: params.day,
      schedule: params.schedule,
      from_full_time: "0",
      time: "0",
      people: "1",
      comments: "",
      app_action: "add_reservation",
      fn_redirect: "reservations",
      callback: "poster_callback",
      _: Date.now().toString(), // Cache buster
    });

    return `${this.baseUrl}?${queryParams}`;
  }

  /**
   * Parse JSONP response from API
   * Format: poster_callback({ "poster": { "result": 1, "msg": "..." } })
   */
  private parseJSONPResponse(text: string): ReservationResult {
    // Extract JSON from JSONP wrapper
    const match = text.match(/poster_callback\s*\(\s*(\{.*\})\s*\)/s);

    if (!match) {
      console.error("[API] Invalid response format:", text);
      throw new Error("Invalid JSONP response format");
    }

    const data = JSON.parse(match[1]);
    const poster = data.poster;

    return {
      success: poster.result === 1,
      message: poster.msg,
      rawResponse: data,
    };
  }

  /**
   * Get password hash for debugging/verification
   */
  getPasswordHash(): string {
    return this.passwordHash;
  }
}
