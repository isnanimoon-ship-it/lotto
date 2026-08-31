import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { runWeeklyLotteryUpdate } from "../../../../lib/lottery/weekly-update";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request, secret: string) {
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("Lottery weekly cron is missing CRON_SECRET");
    return NextResponse.json(
      { status: "error", message: "Cron is not configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runWeeklyLotteryUpdate();
    if (result.status === "updated") {
      revalidatePath("/shops/[region]", "page");
      revalidatePath("/shop/[id]", "page");
      revalidatePath("/sitemap.xml");
    }
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Lottery weekly cron failed", error);
    return NextResponse.json(
      { status: "error", message: "Lottery update failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
