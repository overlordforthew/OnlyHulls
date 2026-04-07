import { pool, queryOne } from "../src/lib/db";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    throw new Error("Usage: npx tsx scripts/promote-admin.ts <email>");
  }

  const user = await queryOne<{ id: string; email: string; role: string }>(
    "UPDATE users SET role = 'admin' WHERE lower(email) = $1 RETURNING id, email, role",
    [email]
  );

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  console.log(`Promoted ${user.email} to ${user.role}.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error(err instanceof Error ? err.message : err);
  await pool.end();
  process.exit(1);
});
