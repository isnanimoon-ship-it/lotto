import { cache } from "react";
import { createServerSupabaseClient } from "../supabase/server";
import { getLotteryRegion } from "./regions";

// Human-readable slugs for frequently searched areas. Other source names remain lossless Korean URL segments.
const KNOWN_SLUGS: Record<string, string> = {
  "서울|강남구": "gangnam", "서울|송파구": "songpa",
  "부산|해운대구": "haeundae", "부산|부산진구": "busanjin",
  "경기|수원시": "suwon",
};

export function municipalitySlug(region: string, name: string) {
  return KNOWN_SLUGS[`${region}|${name}`] ?? name;
}

export function isMunicipalityName(region: string, name: string | null | undefined): name is string {
  return !!name && name.trim() !== region && /(?:시|군|구)$/.test(name.trim());
}

export const getMunicipalities = cache(async (regionSlug: string) => {
  const region = getLotteryRegion(regionSlug);
  if (!region) return [];
  const supabase = createServerSupabaseClient();
  const names = new Set<string>();
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from("shops")
      .select("city,shop_stats!inner(first_win_count)")
      .eq("region", region.name).not("city", "is", null)
      .gt("shop_stats.first_win_count", 0)
      .order("id", { ascending: true }).range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Could not load municipalities for ${region.name}: ${error.message}`);
    for (const row of data ?? []) {
      const name = row.city?.trim();
      if (isMunicipalityName(region.name, name)) names.add(name);
    }
    if ((data?.length ?? 0) < pageSize) break;
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ko"))
    .map((name) => ({ name, slug: municipalitySlug(region.name, name) }));
});

export async function resolveMunicipality(regionSlug: string, slug: string) {
  const municipalities = await getMunicipalities(regionSlug);
  return municipalities.find((item) => item.slug === slug);
}
