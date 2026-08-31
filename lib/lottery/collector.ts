import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLotteryRound } from "./client";
import { normalizeLotteryRows, type NormalizedShop } from "./normalize";
import type { LotteryShopResponse } from "./schema";
import { createServerSupabaseClient } from "../supabase/server";

export type CollectionResult = {
  round: number;
  received: number;
  newShops: number;
  updatedShops: number;
  newWins: number;
  duplicateWins: number;
  firstPrize: number;
  secondPrize: number;
  empty: boolean;
  nameFallbacks: number;
  namePlaceholders: number;
  status: "SUCCESS";
};

const comparableShopFields: Array<keyof NormalizedShop> = [
  "name",
  "phone",
  "region",
  "city",
  "district",
  "address",
  "latitude",
  "longitude",
  "operation_status",
  "lotto645_enabled",
  "pension720_enabled",
];

function shopChanged(existing: Record<string, unknown>, incoming: NormalizedShop) {
  return comparableShopFields.some((field) => existing[field] !== incoming[field]);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000);
}

function assertRound(round: number) {
  if (!Number.isSafeInteger(round) || round < 1) {
    throw new Error("Round must be a positive integer");
  }
}

async function readLatestKnownRounds(supabase: SupabaseClient, shopIds: number[]) {
  const latest = new Map<number, number>();
  if (!shopIds.length) return latest;

  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("wins")
      .select("shop_id,round")
      .in("shop_id", shopIds)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not read shop history: ${error.message}`);
    for (const win of data ?? []) {
      const shopId = win.shop_id as number;
      latest.set(shopId, Math.max(latest.get(shopId) ?? 0, win.round as number));
    }
    if ((data?.length ?? 0) < pageSize) break;
  }
  return latest;
}

async function readWinsForStats(supabase: SupabaseClient, shopIds: number[]) {
  const wins: Array<{ shop_id: number; round: number; rank: number }> = [];
  const pageSize = 1_000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("wins")
      .select("shop_id,round,rank")
      .in("shop_id", shopIds)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not recalculate shop stats: ${error.message}`);
    wins.push(...((data ?? []) as Array<{ shop_id: number; round: number; rank: number }>));
    if ((data?.length ?? 0) < pageSize) break;
  }
  return wins;
}

async function startSyncRun(supabase: SupabaseClient, round: number) {
  const { data, error } = await supabase
    .from("sync_runs")
    .insert({ round, status: "running" })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create sync run: ${error.message}`);
  return data.id as number;
}

export type CollectionOptions = {
  sourceRows?: LotteryShopResponse[];
};

export async function collectLotteryRound(
  round: number,
  options: CollectionOptions = {},
): Promise<CollectionResult> {
  assertRound(round);
  const supabase = createServerSupabaseClient();
  const syncRunId = await startSyncRun(supabase, round);

  try {
    const sourceRows = options.sourceRows ?? await fetchLotteryRound(round);
    const { shops, wins } = normalizeLotteryRows(sourceRows);
    if (sourceRows.length === 0) {
      const finishedAt = new Date().toISOString();
      const { error: emptyRunError } = await supabase
        .from("sync_runs")
        .update({
          status: "success",
          shops_received: 0,
          wins_inserted: 0,
          finished_at: finishedAt,
          error_message: null,
        })
        .eq("id", syncRunId);
      if (emptyRunError) throw new Error(`Could not complete empty sync run: ${emptyRunError.message}`);
      return {
        round,
        received: 0,
        newShops: 0,
        updatedShops: 0,
        newWins: 0,
        duplicateWins: 0,
        firstPrize: 0,
        secondPrize: 0,
        empty: true,
        nameFallbacks: 0,
        namePlaceholders: 0,
        status: "SUCCESS",
      };
    }
    const lotteryShopIds = shops.map((shop) => shop.lottery_shop_id);

    const { data: existingShops, error: existingShopsError } = await supabase
      .from("shops")
      .select("id,lottery_shop_id,name,phone,region,city,district,address,latitude,longitude,operation_status,lotto645_enabled,pension720_enabled")
      .in("lottery_shop_id", lotteryShopIds);
    if (existingShopsError) {
      throw new Error(`Could not read existing shops: ${existingShopsError.message}`);
    }

    const existingByLotteryId = new Map<string, Record<string, any>>(
      (existingShops ?? []).map((shop) => [shop.lottery_shop_id as string, shop]),
    );
    let nameFallbacks = 0;
    let namePlaceholders = 0;
    for (const shop of shops) {
      if (shop.name) continue;
      const existingName = existingByLotteryId.get(shop.lottery_shop_id)?.name;
      if (typeof existingName !== "string" || !existingName.trim()) {
        shop.name = "-";
        namePlaceholders += 1;
        console.warn(
          `Shop ${shop.lottery_shop_id} has a null source name in round ${round}; using a temporary placeholder`,
        );
        continue;
      }
      shop.name = existingName;
      nameFallbacks += 1;
      console.warn(
        `Shop ${shop.lottery_shop_id} has a null source name in round ${round}; preserving existing name`,
      );
    }
    const latestKnownRounds = await readLatestKnownRounds(
      supabase,
      (existingShops ?? []).map((shop) => shop.id as number),
    );
    const newShops = shops.filter((shop) => !existingByLotteryId.has(shop.lottery_shop_id));
    const updatedShops = shops.filter((shop) => {
      const existing = existingByLotteryId.get(shop.lottery_shop_id);
      if (!existing || !shopChanged(existing, shop)) return false;
      const latestKnownRound = latestKnownRounds.get(existing.id as number) ?? 0;
      return round >= latestKnownRound;
    });
    const shopsToWrite = [...newShops, ...updatedShops].map((shop) => ({
      ...shop,
      updated_at: new Date().toISOString(),
    }));

    if (shopsToWrite.length) {
      const { data: writtenShops, error: shopsWriteError } = await supabase
        .from("shops")
        .upsert(shopsToWrite, { onConflict: "lottery_shop_id" })
        .select("id,lottery_shop_id");
      if (shopsWriteError) throw new Error(`Could not upsert shops: ${shopsWriteError.message}`);
      for (const shop of writtenShops ?? []) {
        existingByLotteryId.set(shop.lottery_shop_id as string, shop);
      }
    }

    const missingShopIds = lotteryShopIds.filter((id) => !existingByLotteryId.has(id));
    if (missingShopIds.length) {
      throw new Error(`Could not resolve ${missingShopIds.length} internal shop IDs`);
    }

    const winRows = wins.map((win) => ({
      shop_id: existingByLotteryId.get(win.lotteryShopId)!.id as number,
      round,
      rank: win.rank,
      source_rnum: win.sourceRnum,
      occurrence: win.occurrence,
    }));

    const { data: insertedWins, error: winsError } = await supabase
      .from("wins")
      .upsert(winRows, {
        onConflict: "shop_id,round,rank,occurrence",
        ignoreDuplicates: true,
      })
      .select("id");
    if (winsError) throw new Error(`Could not upsert wins: ${winsError.message}`);
    const newWins = insertedWins?.length ?? 0;

    const affectedShopIds = [...new Set(winRows.map((win) => win.shop_id))];
    const allWins = await readWinsForStats(supabase, affectedShopIds);

    const statsByShop = new Map<
      number,
      { first: number; second: number; total: number; lastRound: number }
    >();
    for (const win of allWins) {
      const shopId = win.shop_id as number;
      const stats = statsByShop.get(shopId) ?? { first: 0, second: 0, total: 0, lastRound: 0 };
      if (win.rank === 1) stats.first += 1;
      if (win.rank === 2) stats.second += 1;
      stats.total += 1;
      stats.lastRound = Math.max(stats.lastRound, win.round as number);
      statsByShop.set(shopId, stats);
    }

    const now = new Date().toISOString();
    const statsRows = affectedShopIds.map((shopId) => {
      const stats = statsByShop.get(shopId)!;
      return {
        shop_id: shopId,
        first_win_count: stats.first,
        second_win_count: stats.second,
        total_win_count: stats.total,
        last_win_round: stats.lastRound,
        updated_at: now,
      };
    });
    const { error: statsError } = await supabase
      .from("shop_stats")
      .upsert(statsRows, { onConflict: "shop_id" });
    if (statsError) throw new Error(`Could not update shop stats: ${statsError.message}`);

    const result: CollectionResult = {
      round,
      received: sourceRows.length,
      newShops: newShops.length,
      updatedShops: updatedShops.length,
      newWins,
      duplicateWins: winRows.length - newWins,
      firstPrize: wins.filter((win) => win.rank === 1).length,
      secondPrize: wins.filter((win) => win.rank === 2).length,
      empty: false,
      nameFallbacks,
      namePlaceholders,
      status: "SUCCESS",
    };

    const { error: successError } = await supabase
      .from("sync_runs")
      .update({
        status: "success",
        shops_received: result.received,
        wins_inserted: result.newWins,
        finished_at: now,
        error_message: null,
      })
      .eq("id", syncRunId);
    if (successError) throw new Error(`Could not complete sync run: ${successError.message}`);

    return result;
  } catch (error) {
    console.error(`Lottery collection failed for round ${round}`, error);
    const { error: syncError } = await supabase
      .from("sync_runs")
      .update({
        status: "failed",
        error_message: errorMessage(error),
        finished_at: new Date().toISOString(),
      })
      .eq("id", syncRunId);
    if (syncError) console.error("Could not mark sync run as failed", syncError);
    throw new Error(`Lottery collection failed for round ${round}: ${errorMessage(error)}`);
  }
}
