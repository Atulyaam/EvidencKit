import { redactString } from "@evidencekit/core";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogRecord {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export function logStructured(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>
): void {
  const { text: safeMessage } = redactString(message);
  const safeContext: Record<string, unknown> = {};

  if (context) {
    for (const [key, val] of Object.entries(context)) {
      if (typeof val === "string") {
        safeContext[key] = redactString(val).text;
      } else {
        safeContext[key] = val;
      }
    }
  }

  const record: LogRecord = {
    level,
    message: safeMessage,
    timestamp: new Date().toISOString(),
    ...(Object.keys(safeContext).length > 0 ? { context: safeContext } : {})
  };

  const output = JSON.stringify(record);

  switch (level) {
    case "error":
      console.error(output);
      break;
    case "warn":
      console.warn(output);
      break;
    case "info":
      console.info(output);
      break;
    case "debug":
      console.debug(output);
      break;
  }
}
