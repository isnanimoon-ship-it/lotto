import type { MetadataRoute } from "next";
import { isMunicipalityName, municipalitySlug } from "../lib/map/municipalities";
import { LOTTERY_REGIONS } from "../lib/map/regions";
import { createServerSupabaseClient } from "../lib/supabase/server";

const SITE_URL = "https://lotto.konly.co.kr";
const PAGE_SIZE = 1000;

async function getIndexedShops() {
  const supabase = createServerSupabaseClient();
  const ids: number[] = [];
  const municipalities = new Set<string>();
  const regionSlugs = new Map<string, string>(LOTTERY_REGIONS.map(({ name, slug }) => [name, slug]));
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("shops")
      .select("id,region,city,shop_stats(first_win_count)")
      .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not build shop sitemap: ${error.message}`);
    for (const shop of data ?? []) {
      ids.push(shop.id);
      const region = shop.region;
      const city = shop.city?.trim();
      const regionSlug = region && regionSlugs.get(region);
      const stats = Array.isArray(shop.shop_stats) ? shop.shop_stats[0] : shop.shop_stats;
      if (region && regionSlug && isMunicipalityName(region, city) && (stats?.first_win_count ?? 0) > 0) {
        municipalities.add(`/shops/${regionSlug}/${encodeURIComponent(municipalitySlug(region, city))}`);
      }
    }
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return { ids, municipalities: [...municipalities].sort() };
}

async function getCollectedRounds() {
  const supabase = createServerSupabaseClient();
  const rounds = new Set<number>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase.from("sync_runs").select("round")
      .eq("status", "success").order("round", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Could not build round sitemap: ${error.message}`);
    for (const run of data ?? []) if (Number.isSafeInteger(run.round) && run.round > 0) rounds.add(run.round);
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }
  return [...rounds].sort((a, b) => a - b);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ ids, municipalities }, rounds] = await Promise.all([getIndexedShops(), getCollectedRounds()]);
  const pages = [
    { path: "/", priority: 1 },
    { path: "/lotto-first", priority: 0.9 },
    { path: "/nearby", priority: 0.8 },
    { path: "/regions", priority: 0.8 },
    { path: "/guide/lotto-first-prize-shop", priority: 0.7 },
    { path: "/guide/lotto-myeongdang", priority: 0.7 },
    ...LOTTERY_REGIONS.map(({ slug }) => ({ path: `/shops/${slug}`, priority: 0.8 })),
    ...municipalities.map((path) => ({ path, priority: 0.7 })),
    ...rounds.map((round) => ({ path: `/round/${round}`, priority: 0.6 })),
    ...ids.map((id) => ({ path: `/shop/${id}`, priority: 0.5 })),
  ];
  if (pages.length > 50_000) throw new Error("Sitemap exceeds 50,000 URLs; split it before publishing");
  return pages.map(({ path, priority }) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly" as const,
    priority,
  }));
}
