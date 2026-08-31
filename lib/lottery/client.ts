import { lotteryResponseSchema } from "./schema";

const ENDPOINT =
  "https://www.dhlottery.co.kr/wnprchsplcsrch/selectLtWnShp.do";

export async function fetchLotteryRound(round: number) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("srchWnShpRnk", "all");
  url.searchParams.set("srchLtEpsd", String(round));
  url.searchParams.set("srchShpLctn", "");
  url.searchParams.set("_", String(Date.now()));

  let response: Response | undefined;
  const backoffs = [2_000, 5_000];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "lottery-shop-collector/1.0",
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      if (attempt === 2) {
        throw new Error("Donghaeng Lottery request failed after 3 attempts", { cause: error });
      }
      await new Promise((resolve) => setTimeout(resolve, backoffs[attempt]));
      continue;
    }

    if (response.ok) break;
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt === 2) {
      throw new Error(`Donghaeng Lottery returned HTTP ${response.status}`);
    }
    const retryAfter = Number(response.headers.get("retry-after"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1_000
      : backoffs[attempt];
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  if (!response?.ok) throw new Error("Donghaeng Lottery request did not complete");
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("json")) {
    throw new Error(`Donghaeng Lottery returned non-JSON content: ${contentType || "unknown"}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    throw new Error("Donghaeng Lottery returned invalid JSON", { cause: error });
  }

  const parsed = lotteryResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(`Donghaeng Lottery response validation failed: ${parsed.error.message}`);
  }
  return parsed.data.data.list;
}
