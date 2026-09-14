import { cache } from "react";
import { createServerSupabaseClient } from "../supabase/server";

export function parseLotteryRound(raw: string) {
  if (!/^[1-9]\d{0,4}$/.test(raw)) return null;
  const round = Number(raw);
  return Number.isSafeInteger(round) ? round : null;
}

export function drawDate(round: number) {
  // The first Lotto 6/45 draw was Saturday 2002-12-07; subsequent draws are weekly.
  return new Date(Date.UTC(2002, 11, 7 + (round - 1) * 7));
}

export const getRecentRounds = cache(async (limit = 5) => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("wins").select("round")
    .eq("rank", 1).order("round", { ascending: false }).limit(200);
  if (error) throw new Error(`Could not load recent rounds: ${error.message}`);
  return [...new Set((data ?? []).map((row) => row.round))].slice(0, limit);
});

export const getRoundShops = cache(async (round: number) => {
  const supabase = createServerSupabaseClient();
  const { data: wins, count, error } = await supabase.from("wins")
    .select("shop_id,rank,occurrence,source_rnum", { count: "exact" })
    .eq("round", round).order("rank", { ascending: true })
    .order("source_rnum", { ascending: true }).range(0, 999);
  if (error) throw new Error(`Could not load round ${round}: ${error.message}`);
  if ((count ?? 0) > 1000) throw new Error(`Round ${round} has more than 1000 wins`);
  if (!wins?.length) return null;
  const ids = [...new Set(wins.map((win) => win.shop_id))];
  const { data: shops, error: shopsError } = await supabase.from("shops")
    .select("id,name,address,region,shop_stats(first_win_count,second_win_count)")
    .in("id", ids);
  if (shopsError) throw new Error(`Could not load round ${round} shops: ${shopsError.message}`);
  const byId = new Map((shops ?? []).map((shop) => [shop.id, shop]));
  return wins.map((win) => {
    const shop = byId.get(win.shop_id);
    if (!shop) throw new Error(`Round ${round} references missing shop ${win.shop_id}`);
    const stats = Array.isArray(shop.shop_stats) ? shop.shop_stats[0] : shop.shop_stats;
    return {
      rank: win.rank as 1 | 2,
      occurrence: win.occurrence as number,
      sourceRnum: win.source_rnum as number | null,
      shop: {
        id: shop.id, name: shop.name === "-" ? "상호명 미등록" : shop.name,
        address: shop.address, region: shop.region,
        firstWinCount: stats?.first_win_count ?? 0,
        secondWinCount: stats?.second_win_count ?? 0,
      },
    };
  });
});
