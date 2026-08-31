import dotenv from "dotenv";
import { collectLotteryRounds } from "../lib/lottery/backfill";

dotenv.config({ path: ".env.local", override: true, quiet: true });

const args = process.argv.slice(2);
const continueOnError = args.includes("--continue-on-error");
const positional = args.filter((argument) => !argument.startsWith("--"));
const startRound = Number(positional[0]);
const endRound = Number(positional[1]);
const INITIAL_BACKFILL_MIN_ROUND = 262;
const INITIAL_BACKFILL_MAX_ROUND = 1238;
const configuredDelay = process.env.LOTTERY_BACKFILL_DELAY_MS ?? "800";
const delayMs = Number(configuredDelay);
const jitterMs = Number(process.env.LOTTERY_BACKFILL_JITTER_MS ?? "400");

if (
  !Number.isSafeInteger(startRound) ||
  !Number.isSafeInteger(endRound) ||
  startRound < 1 ||
  endRound < startRound
) {
  console.error(
    "Usage: npm run lottery:backfill -- <start-round> <end-round> [--continue-on-error]",
  );
  process.exit(1);
}
if (startRound < INITIAL_BACKFILL_MIN_ROUND || endRound > INITIAL_BACKFILL_MAX_ROUND) {
  console.error(
    `Initial backfill range must stay within ${INITIAL_BACKFILL_MIN_ROUND}-${INITIAL_BACKFILL_MAX_ROUND}`,
  );
  process.exit(1);
}

console.log(`Backfill ${startRound} → ${endRound}`);
console.log(`Total rounds: ${endRound - startRound + 1}`);
console.log(`Delay: ${delayMs}ms + jitter 0-${jitterMs}ms | Failure policy: ${continueOnError ? "continue" : "stop"}`);

try {
  const totals = { received: 0, newShops: 0, updatedShops: 0, newWins: 0, duplicates: 0 };
  const emptyRounds: number[] = [];
  const results = await collectLotteryRounds(startRound, endRound, {
    delayMs,
    jitterMs,
    continueOnError,
    onRoundComplete(entry, progress, total) {
      console.log("");
      if (entry.status === "success") {
        totals.received += entry.result.received;
        totals.newShops += entry.result.newShops;
        totals.updatedShops += entry.result.updatedShops;
        totals.newWins += entry.result.newWins;
        totals.duplicates += entry.result.duplicateWins;
        if (entry.result.empty) emptyRounds.push(entry.round);
        console.log(`[${entry.round}] SUCCESS`);
        if (entry.result.empty) console.log("WARNING: Valid response but 0 winning shops");
        if (entry.result.nameFallbacks) {
          console.log(`WARNING: Preserved ${entry.result.nameFallbacks} existing shop name(s)`);
        }
        if (entry.result.namePlaceholders) {
          console.log(`WARNING: Created ${entry.result.namePlaceholders} temporary shop name placeholder(s)`);
        }
        console.log(`Received: ${entry.result.received}`);
        console.log(`New wins: ${entry.result.newWins}`);
        console.log(`Duplicates: ${entry.result.duplicateWins}`);
      } else {
        console.log(`[${entry.round}] FAILED`);
        console.log(`Error: ${entry.error}`);
      }
      console.log(`Progress: ${progress} / ${total}`);
      console.log(`Percent: ${((progress / total) * 100).toFixed(1)}%`);
    },
  });
  const failed = results.filter((entry) => entry.status === "failed");
  console.log("");
  console.log(`Backfill status: ${failed.length ? "COMPLETED WITH FAILURES" : "SUCCESS"}`);
  console.log(`Processed: ${results.length}, Success: ${results.length - failed.length}, Failed: ${failed.length}`);
  console.log(`Rows received: ${totals.received}`);
  console.log(`New shops: ${totals.newShops}, Updated shops: ${totals.updatedShops}`);
  console.log(`New wins: ${totals.newWins}, Duplicate wins: ${totals.duplicates}`);
  console.log(`Empty rounds: ${emptyRounds.length ? emptyRounds.join(", ") : "none"}`);
  if (failed.length) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Backfill failed");
  process.exit(1);
}
