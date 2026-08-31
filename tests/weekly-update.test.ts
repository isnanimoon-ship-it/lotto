import { describe, expect, it, vi } from "vitest";
import type { CollectionResult } from "../lib/lottery/collector.js";
import type { LotteryShopResponse } from "../lib/lottery/schema.js";
import { runWeeklyLotteryUpdate } from "../lib/lottery/weekly-update.js";

const row = { ltShpId: "test" } as LotteryShopResponse;

function collection(round: number): CollectionResult {
  return {
    round,
    received: 1,
    newShops: 0,
    updatedShops: 0,
    newWins: 1,
    duplicateWins: 0,
    firstPrize: 1,
    secondPrize: 0,
    empty: false,
    nameFallbacks: 0,
    namePlaceholders: 0,
    status: "SUCCESS",
  };
}

describe("runWeeklyLotteryUpdate", () => {
  it("does not create a sync run when the next round is unavailable", async () => {
    const collectRound = vi.fn();
    const result = await runWeeklyLotteryUpdate({}, {
      getLatestStoredRound: vi.fn(async () => 1239),
      fetchRound: vi.fn(async () => []),
      collectRound,
    });

    expect(result.status).toBe("no_new_round");
    expect(result.nextUnavailableRound).toBe(1240);
    expect(collectRound).not.toHaveBeenCalled();
  });

  it("collects missing rounds sequentially and stops at the first unavailable round", async () => {
    const fetchRound = vi.fn(async (round: number) => round <= 1240 ? [row] : []);
    const collectRound = vi.fn(async (round: number) => collection(round));
    const result = await runWeeklyLotteryUpdate({}, {
      getLatestStoredRound: vi.fn(async () => 1238),
      fetchRound,
      collectRound,
    });

    expect(result.status).toBe("updated");
    expect(result.latestStoredRoundAfter).toBe(1240);
    expect(result.nextUnavailableRound).toBe(1241);
    expect(collectRound.mock.calls.map(([round]) => round)).toEqual([1239, 1240]);
    expect(fetchRound.mock.calls.map(([round]) => round)).toEqual([1239, 1240, 1241]);
  });

  it("limits catch-up work per invocation", async () => {
    const result = await runWeeklyLotteryUpdate({ maxRounds: 2 }, {
      getLatestStoredRound: vi.fn(async () => 1238),
      fetchRound: vi.fn(async () => [row]),
      collectRound: vi.fn(async (round: number) => collection(round)),
    });

    expect(result.latestStoredRoundAfter).toBe(1240);
    expect(result.reachedLimit).toBe(true);
    expect(result.nextUnavailableRound).toBeNull();
  });
});
