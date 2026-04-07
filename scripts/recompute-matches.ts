import { pool } from "../src/lib/db/index";
import { computeAllMatches } from "../src/lib/matching/engine";

async function main() {
  const result = await computeAllMatches();
  console.log(JSON.stringify(result));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
