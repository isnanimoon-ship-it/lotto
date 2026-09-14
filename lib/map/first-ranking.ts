import { createServerSupabaseClient } from "../supabase/server";

export const RANKING_PAGE_SIZE = 50;

export async function getFirstPrizeRankingCount() {
  const supabase = createServerSupabaseClient();
  const { count, error } = await supabase.from("shop_stats")
    .select("shop_id", { count: "exact", head: true })
    .gt("first_win_count", 0);
  if (error) throw new Error(`Could not count first prize shops: ${error.message}`);
  return count ?? 0;
}

type RankingRow = {
  shop_id: number;
  first_win_count: number;
  second_win_count: number;
  total_win_count: number;
  last_win_round: number | null;
  shops: { id: number; name: string; address: string; region: string | null } | Array<{ id: number; name: string; address: string; region: string | null }>;
};

export async function getFirstPrizeRanking(offset: number, limit: number) {
  const supabase = createServerSupabaseClient();
  const { data, count, error } = await supabase
    .from("shop_stats")
    .select("shop_id,first_win_count,second_win_count,total_win_count,last_win_round,shops!inner(id,name,address,region)", { count: "exact" })
    .gt("first_win_count", 0)
    .order("first_win_count", { ascending: false })
    .order("second_win_count", { ascending: false })
    .order("last_win_round", { ascending: false, nullsFirst: false })
    .order("shop_id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new Error(`Could not load first prize ranking: ${error.message}`);
  const shops = ((data ?? []) as unknown as RankingRow[]).map((row) => {
    const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;
    return {
      id: shop.id,
      name: shop.name === "-" ? "상호명 미등록" : shop.name,
      address: shop.address,
      region: shop.region,
      firstWinCount: row.first_win_count,
      secondWinCount: row.second_win_count,
      totalWinCount: row.total_win_count,
      lastWinRound: row.last_win_round,
    };
  });
  return { shops, count: count ?? 0 };
}
