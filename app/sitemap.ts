import type { MetadataRoute } from "next";
import { LOTTERY_REGIONS } from "../lib/map/regions";
import { createServerSupabaseClient } from "../lib/supabase/server";

const SITE_URL = "https://lotto.konly.co.kr";

async function getShopIds() {
  const supabase = createServerSupabaseClient();
  const ids: number[] = [];
  const pageSize = 1_000;
  for (let from = 0; from < 49_000; from += pageSize) {
    const { data, error } = await supabase.from("shops").select("id").order("id").range(from, from + pageSize - 1);
    if (error) throw new Error(`Could not build shop sitemap: ${error.message}`);
    ids.push(...(data ?? []).map((shop) => shop.id));
    if (!data || data.length < pageSize) break;
  }
  return ids;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const shopIds = await getShopIds();
  const lastModified = new Date();
  return [{
    url: `${SITE_URL}/map`,
    lastModified,
    changeFrequency: "weekly",
    priority: 1,
  }, ...LOTTERY_REGIONS.map(({ slug }) => ({
    url: `${SITE_URL}/shops/${slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  })), ...shopIds.map((id) => ({
    url: `${SITE_URL}/shop/${id}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }))];
}
