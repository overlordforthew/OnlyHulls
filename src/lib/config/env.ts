/**
 * Environment variable validation.
 *
 * Import `env` anywhere server-side to get typed, validated config.
 * The validation runs once on first access; if a required variable is
 * missing the process exits immediately with a clear error message.
 *
 * NOTE: This module intentionally avoids importing the pino logger to
 * prevent circular dependency issues — env may be imported before the
 * logger is initialised. Startup logging uses process.stderr directly.
 */

const required = [
  "DATABASE_URL",
  "REDIS_URL",
  "AUTH_SECRET",
  "MEILISEARCH_API_KEY",
] as const;

const optional = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "MEDIA_BACKEND",
  "LOCAL_MEDIA_ROOT",
  "S3_ENDPOINT",
  "S3_REGION",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "OPENAI_API_KEY",
  "OPENAI_EMBEDDING_MODEL",
  "AI_PROVIDER",
  "OPENROUTER_KEY",
  "OPENROUTER_CHAT_MODEL",
  "OPENROUTER_EMBEDDING_MODEL",
  "OLLAMA_URL",
  "OLLAMA_CHAT_MODEL",
  "OPENAI_CHAT_MODEL",
  "OLLAMA_TIMEOUT_MS",
  "CLAUDE_PROXY_URL",
  "RESEND_API_KEY",
  "MEILISEARCH_URL",
  "RESEND_FROM_EMAIL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "NEXT_PUBLIC_APP_URL",
  "NEXTAUTH_URL",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "STRIPE_PRICE_BUYER_PLUS",
  "STRIPE_PRICE_SELLER_STANDARD",
  "STRIPE_PRICE_SELLER_FEATURED",
  "STRIPE_PRICE_BROKER",
  "LOG_LEVEL",
] as const;

type RequiredKey = (typeof required)[number];
type OptionalKey = (typeof optional)[number];

type Env = Record<RequiredKey, string> & Record<OptionalKey, string | undefined>;

function validateEnv(): Env {
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const msg = `Missing required environment variables:\n  ${missing.join("\n  ")}`;
    // In production, crash hard so the container restarts and operators notice.
    // In development, log a warning but keep going (some services may not be needed).
    if (process.env.NODE_ENV === "production") {
      const entry = JSON.stringify({ level: 60, time: Date.now(), msg: `FATAL: ${msg}`, module: "env" });
      process.stderr.write(entry + "\n");
      process.exit(1);
    } else {
      const entry = JSON.stringify({ level: 40, time: Date.now(), msg: `WARNING: ${msg}`, module: "env" });
      process.stderr.write(entry + "\n");
    }
  }

  // Build the typed object from process.env
  const result: Record<string, string | undefined> = {};
  for (const key of required) {
    result[key] = process.env[key]!;
  }
  for (const key of optional) {
    result[key] = process.env[key];
  }
  return result as Env;
}

/** Validated, typed environment config. Lazily initialised on first access. */
let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = validateEnv();
  }
  return _env;
}

export const env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return getEnv()[prop as keyof Env];
  },
});
