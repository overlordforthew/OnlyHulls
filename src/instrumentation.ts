/**
 * Next.js Instrumentation hook — runs once when the server starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Eagerly validates environment variables so missing config surfaces
 * immediately on deploy rather than on the first request.
 */
export async function register() {
  // Only validate on the Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/lib/config/env");
    getEnv(); // triggers validation; exits process if required vars are missing
    const { logger } = await import("@/lib/logger");
    logger.info("Environment validated — all required variables present");
  }
}
