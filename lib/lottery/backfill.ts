import { collectLotteryRound, type CollectionResult } from "./collector";

export type BackfillRoundResult =
  | { round: number; status: "success"; result: CollectionResult }
  | { round: number; status: "failed"; error: string };

export type BackfillOptions = {
  delayMs?: number;
  jitterMs?: number;
  continueOnError?: boolean;
  onRoundComplete?: (result: BackfillRoundResult, progress: number, total: number) => void;
};

export class BackfillStoppedError extends Error {
  constructor(
    public readonly failedRound: number,
    public readonly results: BackfillRoundResult[],
    options?: ErrorOptions,
  ) {
    super(`Backfill stopped after round ${failedRound} failed`, options);
    this.name = "BackfillStoppedError";
  }
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function validateRange(startRound: number, endRound: number, delayMs: number) {
  if (!Number.isSafeInteger(startRound) || startRound < 1) {
    throw new Error("Start round must be a positive integer");
  }
  if (!Number.isSafeInteger(endRound) || endRound < startRound) {
    throw new Error("End round must be an integer greater than or equal to start round");
  }
  if (!Number.isSafeInteger(delayMs) || delayMs < 0 || delayMs > 60_000) {
    throw new Error("Delay must be an integer between 0 and 60000 milliseconds");
  }
}

export async function collectLotteryRounds(
  startRound: number,
  endRound: number,
  options: BackfillOptions = {},
) {
  const delayMs = options.delayMs ?? 800;
  const jitterMs = options.jitterMs ?? 400;
  validateRange(startRound, endRound, delayMs);
  if (!Number.isSafeInteger(jitterMs) || jitterMs < 0 || jitterMs > 60_000) {
    throw new Error("Jitter must be an integer between 0 and 60000 milliseconds");
  }

  const total = endRound - startRound + 1;
  const results: BackfillRoundResult[] = [];
  for (let round = startRound; round <= endRound; round += 1) {
    try {
      const result = await collectLotteryRound(round);
      const entry: BackfillRoundResult = { round, status: "success", result };
      results.push(entry);
      options.onRoundComplete?.(entry, results.length, total);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const entry: BackfillRoundResult = { round, status: "failed", error: message };
      results.push(entry);
      options.onRoundComplete?.(entry, results.length, total);
      if (!options.continueOnError) {
        throw new BackfillStoppedError(round, results, { cause: error });
      }
    }

    if (round < endRound) {
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
      if (delayMs + jitter > 0) await wait(delayMs + jitter);
    }
  }
  return results;
}
