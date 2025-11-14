/**
 * Message Classifier for API responses
 *
 * Classifies Spanish error/success messages into readable error types
 * Extracted from error-detection.ts to work with plain text (no Frame needed)
 */

export type MessageType =
  | "SUCCESS"
  | "SLOT_TAKEN"
  | "RESERVATION_LIMIT"
  | "NOT_YET_AVAILABLE"
  | "UNKNOWN";

export interface ClassifiedMessage {
  type: MessageType;
  friendlyMessage: string;
  rawMessage: string;
  days?: string;
}

/**
 * Classify a Spanish response message into a friendly error type
 *
 * @param message - The Spanish message from the API
 * @returns Classified message with friendly English description
 */
export function classifyMessage(message: string): ClassifiedMessage {
  if (!message) {
    return {
      type: "UNKNOWN",
      friendlyMessage: "No response content found",
      rawMessage: "",
    };
  }

  // Normalize message for robust pattern matching (remove diacritics, collapse whitespace)
  const msg = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics (é→e, á→a, etc.)
    .replace(/\s+/g, " ");

  // Pattern 1: Success
  // Example: "Su reservación se ha realizado con éxito y ya se encuentra aprobada."
  if (/se\s+ha\s+realizado.*exito/.test(msg)) {
    return {
      type: "SUCCESS",
      friendlyMessage: "Reservation successful",
      rawMessage: message,
    };
  }

  // Pattern 2: Date not available yet (too far ahead)
  // Examples:
  //  - "Esta fecha aún no está disponible para reservación. Las reservaciones serán habilitadas 8 días antes."
  //  - "Esta fecha aun no esta disponible para reservacion."
  //  - "Fecha no se encuentra habilitada para reservación"
  if (
    (/aun\s+no\s+esta\s+disponible/.test(msg) ||
      /no\s+(esta|se\s+encuentra)\s+(disponible|habilitada)/.test(msg)) &&
    /(reservacion|reservaciones)/.test(msg)
  ) {
    const daysMatch = msg.match(/(\d+)\s+dias?\s+(antes|previo|previos)/);
    return {
      type: "NOT_YET_AVAILABLE",
      friendlyMessage: `Date not available yet - reservations open ${daysMatch?.[1] || "?"} days before`,
      rawMessage: message,
      days: daysMatch?.[1],
    };
  }

  // Pattern 3: Slot already taken (race condition - someone else reserved it)
  // Example: "Su reservación excede la cantidad máxima... ya existen otras reservaciones"
  if (
    /(ya\s+existen\s+otras\s+reservaciones|excede\s+la\s+cantidad\s+maxima)/.test(
      msg,
    )
  ) {
    return {
      type: "SLOT_TAKEN",
      friendlyMessage:
        "Time slot already taken - someone else reserved it first",
      rawMessage: message,
    };
  }

  // Pattern 4: Reservation limit exceeded (user quota reached)
  // Example: "No es posible ingresar la reservación, usted ya há sobrepasado el limite permitido"
  if (
    /(ya\s*ha\s*sobrepasado.*limite|sobrepasado.*limite\s+permitido)/.test(msg)
  ) {
    return {
      type: "RESERVATION_LIMIT",
      friendlyMessage:
        "Reservation limit exceeded - you have already used your allowed reservations",
      rawMessage: message,
    };
  }

  // Unknown - return raw message for manual inspection
  return {
    type: "UNKNOWN",
    friendlyMessage: `Could not classify response: "${message}"`,
    rawMessage: message,
  };
}

/**
 * Get a user-friendly status icon for email display
 */
export function getStatusIcon(type: MessageType): string {
  switch (type) {
    case "SUCCESS":
      return "✅";
    case "SLOT_TAKEN":
      return "⏱️";
    case "RESERVATION_LIMIT":
      return "🚫";
    case "NOT_YET_AVAILABLE":
      return "📅";
    case "UNKNOWN":
      return "❓";
  }
}
