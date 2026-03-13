/**
 * Central error codes and messages for API and server actions.
 * Use getMessage() for user-facing copy; codes enable programmatic handling and i18n later.
 */

export const ERROR_CODES = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  RATE_LIMITED: "RATE_LIMITED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_JSON: "INVALID_JSON",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.UNAUTHORIZED]: "Unauthorized. Provide a valid X-API-Key for this tenant.",
  [ERROR_CODES.FORBIDDEN]: "Forbidden.",
  [ERROR_CODES.NOT_FOUND]: "Not found.",
  [ERROR_CODES.RATE_LIMITED]: "Too many requests.",
  [ERROR_CODES.VALIDATION_ERROR]: "Validation failed.",
  [ERROR_CODES.INVALID_JSON]: "Invalid JSON body.",
  [ERROR_CODES.CONFLICT]: "Conflict.",
  [ERROR_CODES.INTERNAL]: "An error occurred.",
};

/** Get user-facing message for a code; override with custom message when needed. */
export function getMessage(code: ErrorCode, override?: string): string {
  return override ?? MESSAGES[code];
}

export type ApiErrorPayload = { error: string; code?: string };

/** Build JSON payload for API error responses. */
export function apiErrorPayload(code: ErrorCode, overrideMessage?: string): ApiErrorPayload {
  return { error: getMessage(code, overrideMessage), code };
}
