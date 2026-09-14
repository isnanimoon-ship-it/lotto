import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import { boundingBox, distanceKm, NEARBY_RADII, sortNearby, type NearbyShop, type NearbySort } from "../../../../lib/map/nearby";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const PAGE_SIZE = 1000;
const MAX_CANDIDATES = 5000;

function parameter(params: URLSearchParams, key: string) {
  const raw = params.get(key);
  if (raw === null || raw.trim() === "") return NaN;
  return Number(raw);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = parameter(params, "lat");
  const lng = parameter(params, "lng");
  const radius = parameter(params, "radius");
  const sort = params.get("sort");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 33 || lat > 39.5 || lng < 124 || lng > 132
    || !NEARBY_RADII.some((value) => value === radius)
    || (sort !== "first" && sort !== "distance" && sort !== "recent")) {
    return NextResponse.json({ error: "Invalid nearby search" }, { status: 400 });
  }

  try {
    const supabase = createServerSupabaseClient();
    const box = boundingBox({ lat, lng }, radius);
    type Stats = { first_win_count: number; second_win_count: number };
    const candidates: Array<{ id: number; name: string; address: string; region: string | null; latitude: number; longitude: number; shop_stats: Stats | Stats[] }> = [];
    for (let offset = 0; offset <= MAX_CANDIDATES; offset += PAGE_SIZE) {
      const { data, count, error } = await supabase.from("shops")
        .select("id,name,address,region,latitude,longitude,shop_stats!inner(first_win_count,second_win_count)", { count: offset === 0 ? "exact" : undefined })
        .gte("latitude", box.south).lte("latitude", box.north)
        .gte("longitude", box.west).lte("longitude", box.east)
        .gt("shop_stats.first_win_count", 0)
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1)
        .abortSignal(AbortSignal.timeout(15_000));
      if (error) throw error;
      if (offset === 0 && (count ?? 0) > MAX_CANDIDATES) {
        return NextResponse.json({ error: "too_many_results" }, { status: 422 });
      }
      const rows = (data ?? []) as unknown as typeof candidates;
      candidates.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }

    const shops: NearbyShop[] = candidates.flatMap((row) => {
      const stats = Array.isArray(row.shop_stats) ? row.shop_stats[0] : row.shop_stats;
      if (!stats || row.latitude === null || row.longitude === null) return [];
      const distance = distanceKm({ lat, lng }, { lat: row.latitude, lng: row.longitude });
      return distance <= radius ? [{
        id: row.id, name: row.name === "-" ? "상호명 미등록" : row.name,
        address: row.address, region: row.region, distanceKm: distance,
        firstWinCount: stats.first_win_count,
        secondWinCount: stats.second_win_count,
        lastFirstWinRound: null,
      }] : [];
    });

    // The stats table tracks the latest win of either rank, so derive the latest first-prize round from wins.
    const byId = new Map(shops.map((shop) => [shop.id, shop]));
    const ids = shops.map((shop) => shop.id);
    for (let start = 0; start < ids.length; start += 100) {
      const group = ids.slice(start, start + 100);
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await supabase.from("wins").select("shop_id,round")
          .eq("rank", 1).in("shop_id", group)
          .order("round", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1)
          .abortSignal(AbortSignal.timeout(15_000));
        if (error) throw error;
        for (const win of data ?? []) {
          const shop = byId.get(win.shop_id);
          if (shop && shop.lastFirstWinRound === null) shop.lastFirstWinRound = win.round;
        }
        if ((data?.length ?? 0) < PAGE_SIZE) break;
      }
    }
    sortNearby(shops, sort as NearbySort);
    return NextResponse.json({ count: shops.length, shops: shops.slice(0, 30) }, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    console.error("Nearby shops API failed", { lat, lng, radius, sort, error });
    return NextResponse.json({ error: "Could not load nearby shops" }, { status: 500 });
  }
}
