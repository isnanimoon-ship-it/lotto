import type { LotteryShopResponse } from "./schema";

export type NormalizedShop = {
  lottery_shop_id: string;
  name: string | null;
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
};

export type NormalizedWin = {
  lotteryShopId: string;
  rank: 1 | 2;
  sourceRnum: number;
  occurrence: number;
};

const clean = (value: string | null | undefined) => {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || null;
};

export function normalizeLotteryRows(rows: LotteryShopResponse[]) {
  const shopsById = new Map<string, NormalizedShop>();
  const pendingWins: Array<Omit<NormalizedWin, "occurrence"> & { index: number }> = [];

  rows.forEach((row, index) => {
    const address =
      clean(row.shpAddr) ??
      clean(
        [
          row.tm1ShpLctnAddr,
          row.tm2ShpLctnAddr,
          row.tm3ShpLctnAddr,
          row.tm4ShpLctnAddr,
        ]
          .filter(Boolean)
          .join(" "),
      );
    if (!address) {
      throw new Error(`Shop ${row.ltShpId} (rnum ${row.rnum}) has no usable address`);
    }

    shopsById.set(row.ltShpId.trim(), {
      lottery_shop_id: row.ltShpId.trim(),
      name: clean(row.shpNm),
      phone: clean(row.shpTelno),
      region: clean(row.region) ?? clean(row.tm1ShpLctnAddr),
      city: clean(row.tm2ShpLctnAddr),
      district: clean(row.tm3ShpLctnAddr),
      address,
      latitude: row.shpLat,
      longitude: row.shpLot,
      operation_status: clean(row.slrOperSttsCd),
      lotto645_enabled: row.l645LtNtslYn === "Y",
      pension720_enabled: row.pt720NtslYn === "Y",
    });
    pendingWins.push({
      lotteryShopId: row.ltShpId.trim(),
      rank: row.wnShpRnk,
      sourceRnum: row.rnum,
      index,
    });
  });

  pendingWins.sort(
    (a, b) =>
      a.lotteryShopId.localeCompare(b.lotteryShopId) ||
      a.rank - b.rank ||
      a.sourceRnum - b.sourceRnum ||
      a.index - b.index,
  );

  const occurrences = new Map<string, number>();
  const wins: NormalizedWin[] = pendingWins.map(({ index: _, ...win }) => {
    const key = `${win.lotteryShopId}|${win.rank}`;
    const occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    return { ...win, occurrence };
  });

  return { shops: [...shopsById.values()], wins };
}
