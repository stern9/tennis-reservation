/**
 * Shared TypeScript type definitions for tennis reservation system
 */

export interface CourtConfig {
  areaId: string;
  name: string;
  daysAhead: number;
  slots: Record<string, string>;
}

export type ErrorType =
  | "NOT_YET_AVAILABLE"
  | "SLOT_TAKEN"
  | "RESERVATION_LIMIT"
  | "SUCCESS"
  | "UNKNOWN";

export interface ErrorResult {
  type: ErrorType;
  message: string;
  rawMessage?: string;
  days?: string;
  frameUrl?: string;
}

export interface ReservationResult {
  success: boolean;
  court: string;
  date: string;
  time: string;
}

export interface FrameData {
  url: string;
  title: string;
  bodyText: string;
  innerHTMLSnippet: string;
}

export interface AppConfig {
  loginUrl: string;
  username: string | undefined;
  password: string | undefined;
  emailTo: string;
  emailFrom: string;
  resendApiKey: string | undefined;
  courts: {
    court1: CourtConfig;
    court2: CourtConfig;
  };
}

export interface Args {
  test: boolean;
  dryRun: boolean;
  targetDate: string | null;
  court1Time: string | null;
  court2Time: string | null;
  skipCourt1: boolean;
  skipCourt2: boolean;
  debugMode: boolean;
  watchMode: boolean;
  keepScreenshots: boolean;
  testDelay: string | null;
}
