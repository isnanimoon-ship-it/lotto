import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "../../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: RouteContext<"/api/map/shops/[id]/wins">,
) {
  try {
    const { id } = await context.params;
    const shopId = Number(id);
    if (!Number.isSafeInteger(shopId) || shopId <= 0) {
      return NextResponse.json({ error: "Invalid shop id" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("wins")
      .select("round,rank,occurrence")
      .eq("shop_id", shopId)
      .order("round", { ascending: false })
      .order("rank", { ascending: true })
      .order("occurrence", { ascending: true })
      .abortSignal(AbortSignal.timeout(8_000));

    if (error) throw error;
    return NextResponse.json({ shopId, wins: data ?? [] }, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    console.error("Shop wins API failed", error);
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      { error: timeout ? "Shop wins query timed out" : "Could not load shop wins" },
      { status: timeout ? 504 : 500 },
    );
  }
}
