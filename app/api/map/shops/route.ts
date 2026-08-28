import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";
const MIN_MARKER_ZOOM = 10;
const MAX_RESULTS = 500;

function numeric(params: URLSearchParams, name: string) {
  const raw = params.get(name);
  const value = raw === null ? Number.NaN : Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const north = numeric(params, "north");
    const south = numeric(params, "south");
    const east = numeric(params, "east");
    const west = numeric(params, "west");
    const zoom = numeric(params, "zoom");
    if (north <= south || east <= west || north > 90 || south < -90 || east > 180 || west < -180) {
      return NextResponse.json({ error: "Invalid map bounds" }, { status: 400 });
    }
    if (zoom < MIN_MARKER_ZOOM) {
      return NextResponse.json({ mode: "zoom_in", count: 0, shops: [] });
    }
    const first = params.get("first") !== "false";
    const second = params.get("second") !== "false";
    if (!first && !second) return NextResponse.json({ mode: "markers", count: 0, shops: [] });

    const supabase = createServerSupabaseClient();
    const rpcResult = await supabase.rpc("get_shops_in_bounds", {
      p_north: north,
      p_south: south,
      p_east: east,
      p_west: west,
      p_include_first: first,
      p_include_second: second,
      p_limit: MAX_RESULTS + 1,
    }).abortSignal(AbortSignal.timeout(8_000));
    if (!rpcResult.error) {
      const rows = rpcResult.data ?? [];
      const total = rows.length ? Number(rows[0].total_count) : 0;
      if (total > MAX_RESULTS) return NextResponse.json({ mode: "too_many_results", count: total, shops: [] });
      const shops = rows.map((row: any) => ({
        id: row.id, name: row.name === "-" ? "상호명 미등록" : row.name, address: row.address, lat: row.latitude, lng: row.longitude,
        firstWinCount: row.first_win_count, secondWinCount: row.second_win_count,
        totalWinCount: row.total_win_count, lastWinRound: row.last_win_round,
      }));
      return NextResponse.json({ mode: "markers", count: total, shops }, {
        headers: { "Cache-Control": "private, max-age=15", "X-Map-Query": "postgis" },
      });
    }
    if (rpcResult.error.code !== "PGRST202") throw rpcResult.error;

    // Safe transitional fallback until the PostGIS RPC migration is applied.
    let query = supabase
      .from("shops")
      .select("id,name,address,latitude,longitude,shop_stats!inner(first_win_count,second_win_count,total_win_count,last_win_round)", { count: "exact" })
      .gte("latitude", south).lte("latitude", north)
      .gte("longitude", west).lte("longitude", east)
      .not("latitude", "is", null).not("longitude", "is", null);
    if (first && !second) query = query.gt("shop_stats.first_win_count", 0);
    if (!first && second) query = query.gt("shop_stats.second_win_count", 0);

    const { data, error, count } = await query
      .order("total_win_count", { referencedTable: "shop_stats", ascending: false })
      .limit(MAX_RESULTS + 1)
      .abortSignal(AbortSignal.timeout(8_000));
    if (error) throw error;
    const total = count ?? 0;
    if (total > MAX_RESULTS) return NextResponse.json({ mode: "too_many_results", count: total, shops: [] });

    const shops = (data ?? []).map((row: any) => ({
      id: row.id, name: row.name === "-" ? "상호명 미등록" : row.name, address: row.address, lat: row.latitude, lng: row.longitude,
      firstWinCount: row.shop_stats.first_win_count,
      secondWinCount: row.shop_stats.second_win_count,
      totalWinCount: row.shop_stats.total_win_count,
      lastWinRound: row.shop_stats.last_win_round,
    }));
    return NextResponse.json({ mode: "markers", count: total, shops }, {
      headers: { "Cache-Control": "private, max-age=15", "X-Map-Query": "coordinate-fallback" },
    });
  } catch (error) {
    console.error("Map shops API failed", error);
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json({ error: timeout ? "Map query timed out" : "Could not load map shops" }, { status: timeout ? 504 : 500 });
  }
}
