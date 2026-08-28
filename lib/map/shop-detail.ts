import { cache } from "react";
import { createServerSupabaseClient } from "../supabase/server";

export type ShopDetail = {
  id: number;
  lottery_shop_id: string;
  name: string;
  phone: string | null;
  region: string | null;
  city: string | null;
  district: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  operation_status: string | null;
  lotto645_enabled: boolean;
  pension720_enabled: boolean;
  shop_stats: {
    first_win_count: number;
    second_win_count: number;
    total_win_count: number;
    last_win_round: number | null;
  };
};

export type ShopDetailWin = { round: number; rank: 1 | 2; occurrence: number };

export const getShopDetail = cache(async (id: number) => {
  const supabase = createServerSupabaseClient();
  const [shopResult, winsResult] = await Promise.all([
    supabase
      .from("shops")
      .select("id,lottery_shop_id,name,phone,region,city,district,address,latitude,longitude,operation_status,lotto645_enabled,pension720_enabled,shop_stats!inner(first_win_count,second_win_count,total_win_count,last_win_round)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("wins")
      .select("round,rank,occurrence")
      .eq("shop_id", id)
      .order("round", { ascending: false })
      .order("rank", { ascending: true })
      .order("occurrence", { ascending: true }),
  ]);
  if (shopResult.error) throw new Error(`Could not load shop ${id}: ${shopResult.error.message}`);
  if (winsResult.error) throw new Error(`Could not load wins for shop ${id}: ${winsResult.error.message}`);
  if (!shopResult.data) return null;
  return {
    shop: shopResult.data as unknown as ShopDetail,
    wins: (winsResult.data ?? []) as ShopDetailWin[],
  };
});

export function parseShopId(raw: string) {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
