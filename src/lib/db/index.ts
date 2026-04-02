import { Pool } from "pg";
import { logger } from "@/lib/logger";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected database pool error");
});

export class DatabaseError extends Error {
  public readonly query: string;
  public readonly cause: unknown;

  constructor(message: string, query: string, cause: unknown) {
    super(message);
    this.name = "DatabaseError";
    this.query = query;
    this.cause = cause;
  }
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  try {
    const result = await pool.query(text, params);
    return result.rows as T[];
  } catch (err) {
    // Truncate query text in logs to avoid leaking sensitive data while retaining debuggability
    const safeQuery = text.length > 200 ? text.slice(0, 200) + "..." : text;
    logger.error({ err, query: safeQuery }, "Database query failed");
    throw new DatabaseError("Database query failed", safeQuery, err);
  }
}

export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export { pool };
