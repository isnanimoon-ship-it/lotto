import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/lottery/collector.js", () => ({
  collectLotteryRound: vi.fn(async (round: number) => {
    if (round === 2) throw new Error("test failure");
    return { round, status: "SUCCESS" };
  }),
}));

import { collectLotteryRounds, BackfillStoppedError } from "../lib/lottery/backfill.js";

describe("collectLotteryRounds", () => {
  it("stops on the first failure by default", async () => {
    await expect(collectLotteryRounds(1, 3, { delayMs: 0, jitterMs: 0 })).rejects.toBeInstanceOf(
      BackfillStoppedError,
    );
  });

  it("can record a failure and continue", async () => {
    const results = await collectLotteryRounds(1, 3, {
      delayMs: 0,
      jitterMs: 0,
      continueOnError: true,
    });
    expect(results.map((result) => result.status)).toEqual(["success", "failed", "success"]);
  });

  it("rejects reversed ranges", async () => {
    await expect(collectLotteryRounds(3, 1)).rejects.toThrow(/End round/);
  });
});
