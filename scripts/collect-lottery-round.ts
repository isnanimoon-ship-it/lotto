import "dotenv/config";
import dotenv from "dotenv";
import { collectLotteryRound } from "../lib/lottery/collector.js";

dotenv.config({ path: ".env.local", override: true, quiet: true });

const round = Number(process.argv[2]);
if (!Number.isSafeInteger(round) || round < 1) {
  console.error("Usage: npm run lottery:collect -- <positive-round-number>");
  process.exit(1);
}

try {
  const result = await collectLotteryRound(round);
  console.log(`Round: ${result.round}`);
  console.log("");
  console.log(`Received: ${result.received}`);
  console.log(`New Shops: ${result.newShops}`);
  console.log(`Updated Shops: ${result.updatedShops}`);
  console.log(`New Wins: ${result.newWins}`);
  console.log(`Duplicate Wins: ${result.duplicateWins}`);
  console.log("");
  console.log(`First Prize: ${result.firstPrize}`);
  console.log(`Second Prize: ${result.secondPrize}`);
  if (result.nameFallbacks) console.log(`Name fallbacks: ${result.nameFallbacks}`);
  if (result.namePlaceholders) console.log(`Name placeholders: ${result.namePlaceholders}`);
  console.log("");
  console.log(`Status: ${result.status}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Lottery collection failed");
  process.exit(1);
}
