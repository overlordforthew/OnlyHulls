import { execFileSync } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { DEFAULT_BROWSER_ENV, ensureBrowserTestEnv } from "./load-env";

async function canReachDatabase(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    const port = Number(parsed.port || 5432);
    const host = parsed.hostname;

    return await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host, port });

      const finish = (result: boolean) => {
        socket.removeAllListeners();
        if (!socket.destroyed) {
          socket.destroy();
        }
        resolve(result);
      };

      socket.once("connect", () => finish(true));
      socket.once("error", () => finish(false));
      socket.setTimeout(1500, () => finish(false));
    });
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  const rootDir = path.resolve(__dirname, "..", "..");
  ensureBrowserTestEnv(rootDir);
  const sellerEmail = process.env.PLAYWRIGHT_SELLER_EMAIL || "";
  const sellerPassword = process.env.PLAYWRIGHT_SELLER_PASSWORD || "";
  const hasCustomSellerCredentials =
    Boolean(sellerEmail) &&
    Boolean(sellerPassword) &&
    (sellerEmail !== DEFAULT_BROWSER_ENV.PLAYWRIGHT_SELLER_EMAIL ||
      sellerPassword !== DEFAULT_BROWSER_ENV.PLAYWRIGHT_SELLER_PASSWORD);

  if (!process.env.DATABASE_URL) {
    process.env.PLAYWRIGHT_SELLER_SETUP_READY = hasCustomSellerCredentials ? "1" : "0";
    process.env.PLAYWRIGHT_SELLER_SKIP_REASON = hasCustomSellerCredentials
      ? "Using configured seller credentials without local DB seeding."
      : "DATABASE_URL is not configured for seller browser setup.";
    return;
  }

  if (!(await canReachDatabase(process.env.DATABASE_URL))) {
    process.env.PLAYWRIGHT_SELLER_SETUP_READY = hasCustomSellerCredentials ? "1" : "0";
    process.env.PLAYWRIGHT_SELLER_SKIP_REASON = hasCustomSellerCredentials
      ? "Using configured seller credentials because local DB seeding is unreachable."
      : "Seller browser setup could not reach the configured database from this machine.";
    console.warn(
      hasCustomSellerCredentials
        ? "[playwright] Seller browser setup using configured credentials because the local database is unreachable."
        : "[playwright] Seller browser setup skipped because the database is unreachable."
    );
    return;
  }

  try {
    execFileSync(
      process.execPath,
      [path.join(rootDir, "node_modules", "tsx", "dist", "cli.mjs"), "scripts/ensure-browser-test-user.ts"],
      {
        cwd: rootDir,
        stdio: "inherit",
      }
    );
    process.env.PLAYWRIGHT_SELLER_SETUP_READY = "1";
    process.env.PLAYWRIGHT_SELLER_SKIP_REASON = "";
  } catch {
    process.env.PLAYWRIGHT_SELLER_SETUP_READY = "0";
    process.env.PLAYWRIGHT_SELLER_SKIP_REASON =
      "Seller browser setup could not reach the configured database from this machine.";
    console.warn("[playwright] Seller browser setup skipped because the database is unreachable.");
  }
}
