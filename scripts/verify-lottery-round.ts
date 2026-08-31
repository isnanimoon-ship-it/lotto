import dotenv from "dotenv";
import { createServerSupabaseClient } from "../lib/supabase/server";

dotenv.config({ path: ".env.local", override: true, quiet: true });

const round = Number(process.argv[2]);
if (!Number.isSafeInteger(round) || round < 1) {
  throw new Error("Usage: npm run lottery:verify -- <positive-round-number>");
}

const supabase = createServerSupabaseClient();
const { data: roundWins, error: winsError } = await supabase
  .from("wins")
  .select("shop_id,round,rank,source_rnum,occurrence")
  .eq("round", round);
if (winsError) throw new Error(`Could not read wins: ${winsError.message}`);

const wins = roundWins ?? [];
const winKeys = wins.map(
  (win) => `${win.shop_id}|${win.round}|${win.rank}|${win.occurrence}`,
);
if (new Set(winKeys).size !== winKeys.length) {
  throw new Error("Duplicate win unique keys found");
}
if (wins.some((win) => win.source_rnum == null)) {
  throw new Error("A collected win is missing source_rnum");
}
const groupCounts = new Map<string, number>();
for (const win of wins) {
  const key = `${win.shop_id}|${win.rank}`;
  groupCounts.set(key, (groupCounts.get(key) ?? 0) + 1);
}
const repeatedWinGroups = [...groupCounts.values()].filter((count) => count > 1);

const shopIds = [...new Set(wins.map((win) => win.shop_id as number))];
const { data: shops, error: shopsError } = await supabase
  .from("shops")
  .select("id,lottery_shop_id")
  .in("id", shopIds);
if (shopsError) throw new Error(`Could not read shops: ${shopsError.message}`);
if ((shops?.length ?? 0) !== shopIds.length) throw new Error("A win references a missing shop");
const lotteryIds = (shops ?? []).map((shop) => shop.lottery_shop_id as string);
if (new Set(lotteryIds).size !== lotteryIds.length) {
  throw new Error("Duplicate lottery_shop_id values found");
}

const { data: allAffectedWins, error: allAffectedWinsError } = await supabase
  .from("wins")
  .select("shop_id,round,rank")
  .in("shop_id", shopIds);
if (allAffectedWinsError) throw new Error(allAffectedWinsError.message);
const { data: storedStats, error: statsError } = await supabase
  .from("shop_stats")
  .select("shop_id,first_win_count,second_win_count,total_win_count,last_win_round")
  .in("shop_id", shopIds);
if (statsError) throw new Error(statsError.message);

const statsMap = new Map((storedStats ?? []).map((stats) => [stats.shop_id as number, stats]));
for (const shopId of shopIds) {
  const shopWins = (allAffectedWins ?? []).filter((win) => win.shop_id === shopId);
  const expected = {
    first: shopWins.filter((win) => win.rank === 1).length,
    second: shopWins.filter((win) => win.rank === 2).length,
    total: shopWins.length,
    last: Math.max(...shopWins.map((win) => win.round as number)),
  };
  const actual = statsMap.get(shopId);
  if (
    !actual ||
    actual.first_win_count !== expected.first ||
    actual.second_win_count !== expected.second ||
    actual.total_win_count !== expected.total ||
    actual.last_win_round !== expected.last
  ) {
    throw new Error(`Stats mismatch for shop ${shopId}`);
  }
}

const { data: syncRuns, error: syncError } = await supabase
  .from("sync_runs")
  .select("status,shops_received,wins_inserted,finished_at")
  .eq("round", round)
  .order("started_at", { ascending: false })
  .limit(2);
if (syncError) throw new Error(syncError.message);
if ((syncRuns?.length ?? 0) < 2 || syncRuns!.some((run) => run.status !== "success" || !run.finished_at)) {
  throw new Error("The latest two sync runs are not successful and finished");
}

console.log(`Round ${round} verification: OK`);
console.log(`Shops referenced: ${shopIds.length}`);
console.log(`Wins: ${wins.length}`);
console.log(`First prize wins: ${wins.filter((win) => win.rank === 1).length}`);
console.log(`Second prize wins: ${wins.filter((win) => win.rank === 2).length}`);
console.log(`Repeated shop/rank groups preserved: ${repeatedWinGroups.length}`);
console.log(`Wins in repeated groups: ${repeatedWinGroups.reduce((sum, count) => sum + count, 0)}`);
console.log(`Stats rows verified: ${shopIds.length}`);
console.log(`Latest sync wins_inserted: ${syncRuns![0].wins_inserted}`);
console.log(`Previous sync wins_inserted: ${syncRuns![1].wins_inserted}`);
