import { getDailySourceDecision } from "../src/lib/source-policy";

const [sourceKey, sourceName] = process.argv.slice(2);

if (!sourceKey) {
  console.error("Usage: npx tsx scripts/source-policy-status.ts <source-key> [source-name]");
  process.exit(1);
}

const decision = getDailySourceDecision(sourceKey, sourceName);
console.log(`${decision.run ? "run" : "skip"}\t${decision.status}\t${decision.reason}`);
