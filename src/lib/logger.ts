import pino from "pino";

/**
 * Structured logger for server-side code (API routes, lib modules).
 *
 * - JSON output in production (machine-parseable)
 * - Pretty-ish output in development via pino's default formatter
 * - DO NOT use in client components — this is server-only.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  ...(process.env.NODE_ENV !== "production" && {
    transport: {
      target: "pino/file",
      options: { destination: 1 }, // stdout
    },
  }),
});
