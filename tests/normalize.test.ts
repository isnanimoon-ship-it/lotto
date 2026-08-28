import { describe, expect, it } from "vitest";
import { normalizeLotteryRows } from "../lib/lottery/normalize.js";
import type { LotteryShopResponse } from "../lib/lottery/schema.js";

function row(overrides: Partial<LotteryShopResponse> = {}): LotteryShopResponse {
  return {
    rnum: 1,
    ltShpId: "shop-1",
    shpNm: " Test Shop ",
    shpTelno: null,
    region: "서울",
    tm1ShpLctnAddr: "서울",
    tm2ShpLctnAddr: "중구",
    tm3ShpLctnAddr: "테스트동",
    tm4ShpLctnAddr: null,
    shpAddr: " 서울  중구 테스트동 ",
    slrOperSttsCd: "1",
    l645LtNtslYn: "Y",
    pt720NtslYn: "N",
    wnShpRnk: 2,
    shpLat: 37.5,
    shpLot: 127,
    ...overrides,
  };
}

describe("normalizeLotteryRows", () => {
  it("assigns deterministic occurrences to repeated shop/rank wins", () => {
    const result = normalizeLotteryRows([
      row({ rnum: 66 }),
      row({ rnum: 65 }),
      row({ rnum: 67, wnShpRnk: 1 }),
    ]);

    expect(result.shops).toHaveLength(1);
    expect(result.wins).toEqual([
      { lotteryShopId: "shop-1", rank: 1, sourceRnum: 67, occurrence: 1 },
      { lotteryShopId: "shop-1", rank: 2, sourceRnum: 65, occurrence: 1 },
      { lotteryShopId: "shop-1", rank: 2, sourceRnum: 66, occurrence: 2 },
    ]);
  });

  it("normalizes whitespace and falls back to address components", () => {
    const result = normalizeLotteryRows([row({ shpAddr: null })]);
    expect(result.shops[0].address).toBe("서울 중구 테스트동");
    expect(result.shops[0].name).toBe("Test Shop");
  });

  it("rejects a shop without a usable address", () => {
    expect(() =>
      normalizeLotteryRows([
        row({
          shpAddr: null,
          tm1ShpLctnAddr: null,
          tm2ShpLctnAddr: null,
          tm3ShpLctnAddr: null,
        }),
      ]),
    ).toThrow(/no usable address/);
  });

  it("schema rejects coordinates outside valid earth bounds", async () => {
    const { lotteryShopSchema } = await import("../lib/lottery/schema.js");
    expect(lotteryShopSchema.safeParse(row({ shpLat: 91 })).success).toBe(false);
    expect(lotteryShopSchema.safeParse(row({ shpLot: -181 })).success).toBe(false);
    expect(lotteryShopSchema.safeParse(row({ shpLat: null, shpLot: null })).success).toBe(true);
  });

  it("retains a null source name for collector-level existing-shop fallback", () => {
    const result = normalizeLotteryRows([row({ shpNm: null })]);
    expect(result.shops[0].name).toBeNull();
  });
});
