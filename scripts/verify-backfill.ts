import dotenv from "dotenv";
import { collectLotteryRounds } from "../lib/lottery/backfill.js";
import { createServerSupabaseClient } from "../lib/supabase/server.js";

dotenv.config({ path: ".env.local", override: true, quiet: true });

const startRound = Number(process.argv[2]);
const endRound = Number(process.argv[3]);
const rerun = process.argv.includes("--rerun");
if (
  !Number.isSafeInteger(startRound) ||
  !Number.isSafeInteger(endRound) ||
  startRound < 1 ||
  endRound < startRound
) {
  throw new Error(
    "Usage: npm run lottery:verify-backfill -- <start-round> <end-round> [--rerun]",
  );
}

const supabase = createServerSupabaseClient();
const PAGE_SIZE = 1_000;

async function fetchAllRows(
  table: string,
  columns: string,
  range?: { start: number; end: number },
) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (range) query = query.gte("round", range.start).lte("round", range.end);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return rows;
}

async function readSnapshot() {
  const [shops, rangeWins, stats] = await Promise.all([
    fetchAllRows("shops", "id,name,region,latitude,longitude"),
    fetchAllRows("wins", "shop_id,round,rank,occurrence", {
      start: startRound,
      end: endRound,
    }),
    fetchAllRows(
      "shop_stats",
      "shop_id,first_win_count,second_win_count,total_win_count,last_win_round",
    ),
  ]);
  stats.sort((a, b) => a.shop_id - b.shop_id);
  const regions = new Map<string, number>();
  for (const shop of shops) {
    const region = shop.region || "(unknown)";
    regions.set(region, (regions.get(region) ?? 0) + 1);
  }
  return {
    shopsCount: shops.length,
    shopsWithCoordinates: shops.filter(
      (shop) => shop.latitude != null && shop.longitude != null,
    ).length,
    unknownNameShops: shops.filter((shop) => shop.name === "-").length,
    regions: [...regions].sort((a, b) => b[1] - a[1]),
    rangeWinsCount: rangeWins.length,
    firstWins: rangeWins.filter((win) => win.rank === 1).length,
    secondWins: rangeWins.filter((win) => win.rank === 2).length,
    stats,
    statsFingerprint: JSON.stringify(stats),
  };
}

async function verifyGlobalStats() {
  const [wins, stats] = await Promise.all([
    fetchAllRows("wins", "shop_id,round,rank,occurrence"),
    fetchAllRows("shop_stats", "first_win_count,second_win_count,total_win_count"),
  ]);
  const firstWins = wins.filter((win) => win.rank === 1).length;
  const secondWins = wins.filter((win) => win.rank === 2).length;
  const firstStats = stats.reduce((sum, row) => sum + row.first_win_count, 0);
  const secondStats = stats.reduce((sum, row) => sum + row.second_win_count, 0);
  const totalStats = stats.reduce((sum, row) => sum + row.total_win_count, 0);
  if (firstStats !== firstWins || secondStats !== secondWins || totalStats !== wins.length) {
    throw new Error("Global shop_stats sums do not match wins source of truth");
  }

  const groups = new Map<string, number[]>();
  for (const win of wins) {
    const key = `${win.shop_id}|${win.round}|${win.rank}`;
    const occurrences = groups.get(key) ?? [];
    occurrences.push(win.occurrence);
    groups.set(key, occurrences);
  }
  for (const [key, occurrences] of groups) {
    occurrences.sort((a, b) => a - b);
    if (occurrences.some((value, index) => value !== index + 1)) {
      throw new Error(`Non-contiguous occurrences found for ${key}`);
    }
  }
  return {
    wins: wins.length,
    firstWins,
    secondWins,
    firstStats,
    secondStats,
    totalStats,
    multipleOccurrenceGroups: [...groups.values()].filter((values) => values.length > 1).length,
    maxOccurrencesInGroup: Math.max(...[...groups.values()].map((values) => values.length)),
  };
}

async function verifySyncRuns() {
  const rounds = Array.from(
    { length: endRound - startRound + 1 },
    (_, index) => startRound + index,
  );
  const data = await fetchAllRows("sync_runs", "round,status,finished_at", {
    start: startRound,
    end: endRound,
  });
  const requiredSuccesses = rerun ? 2 : 1;

  for (const round of rounds) {
    const successfulRuns = data.filter(
      (run) => run.round === round && run.status === "success" && run.finished_at,
    );
    if (successfulRuns.length < requiredSuccesses) {
      throw new Error(
        `Round ${round} does not have ${requiredSuccesses} completed successful sync run(s)`,
      );
    }
  }
  return data.length;
}

const before = await readSnapshot();
if (rerun) {
  console.log(`Recollecting ${startRound} → ${endRound} for idempotency verification`);
  await collectLotteryRounds(startRound, endRound, {
    delayMs: Number(process.env.LOTTERY_BACKFILL_DELAY_MS ?? "1000"),
    onRoundComplete(entry, progress, total) {
      const newWins = entry.status === "success" ? entry.result.newWins : "-";
      console.log(`[${entry.round}] ${entry.status.toUpperCase()} newWins=${newWins} (${progress}/${total})`);
    },
  });
}
const after = await readSnapshot();
const global = await verifyGlobalStats();
const syncRunCount = await verifySyncRuns();

if (rerun) {
  if (before.shopsCount !== after.shopsCount) throw new Error("shops count changed after recollection");
  if (before.rangeWinsCount !== after.rangeWinsCount) throw new Error("wins count changed after recollection");
  if (before.statsFingerprint !== after.statsFingerprint) {
    throw new Error("shop_stats values changed after recollection");
  }
}

console.log("");
console.log(`Backfill ${startRound} → ${endRound} verification: OK`);
console.log(`Shops (database): ${after.shopsCount}`);
console.log(`With coordinates: ${after.shopsWithCoordinates}`);
console.log(`Without coordinates: ${after.shopsCount - after.shopsWithCoordinates}`);
console.log(`Shops named '-': ${after.unknownNameShops}`);
console.log(`Regions: ${after.regions.map(([region, count]) => `${region}=${count}`).join(", ")}`);
console.log(`Wins (range): ${after.rangeWinsCount}`);
console.log(`Rank 1 (range): ${after.firstWins}`);
console.log(`Rank 2 (range): ${after.secondWins}`);
console.log(`Multiple occurrence groups (database): ${global.multipleOccurrenceGroups}`);
console.log(`Maximum wins in one shop/round/rank group: ${global.maxOccurrencesInGroup}`);
console.log(`SUM stats.first: ${global.firstStats} = wins rank 1: ${global.firstWins}`);
console.log(`SUM stats.second: ${global.secondStats} = wins rank 2: ${global.secondWins}`);
console.log(`SUM stats.total: ${global.totalStats} = wins total: ${global.wins}`);
console.log(
  `Sync run histories (range): ${syncRunCount}; required successes per round: ${rerun ? 2 : 1} (PASS)`,
);
if (rerun) console.log("Recollection snapshot unchanged: YES");
