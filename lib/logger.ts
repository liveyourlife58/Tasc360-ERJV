/**
 * Simple structured logger for request-scoped context (requestId, tenantId).
 * Use in API routes or server code to attach context to log lines.
 */

type LogContext = { requestId?: string; tenantId?: string; [key: string]: unknown };

function formatMessage(level: string, context: LogContext, message: string, rest: unknown[]): string {
  const parts: string[] = [new Date().toISOString(), level];
  if (Object.keys(context).length > 0) {
    parts.push(JSON.stringify(context));
  }
  parts.push(message);
  if (rest.length > 0) {
    parts.push(rest.map((x) => (typeof x === "object" && x !== null ? JSON.stringify(x) : String(x))).join(" "));
  }
  return parts.join(" ");
}

function log(level: string, context: LogContext, message: string, ...rest: unknown[]): void {
  const line = formatMessage(level, context, message, rest);
  if (level === "ERROR") {
    console.error(line);
  } else if (level === "WARN") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * Create a logger with optional request context. Use in API handlers after resolving requestId/tenantId.
 *
 * Example:
 *   const requestId = request.headers.get("x-request-id") ?? undefined;
 *   const logger = createRequestLogger({ requestId, tenantId });
 *   logger.info("Entity created", { entityId: id });
 */
export function createRequestLogger(context: LogContext) {
  return {
    info(message: string, ...rest: unknown[]) {
      log("INFO", context, message, ...rest);
    },
    warn(message: string, ...rest: unknown[]) {
      log("WARN", context, message, ...rest);
    },
    error(message: string, ...rest: unknown[]) {
      log("ERROR", context, message, ...rest);
    },
    child(extra: LogContext) {
      return createRequestLogger({ ...context, ...extra });
    },
  };
}
