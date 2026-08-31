import { collectLotteryRound, type CollectionResult } from "./collector";
import { fetchLotteryRound } from "./client";
import type { LotteryShopResponse } from "./schema";
import { createServerSupabaseClient } from "../supabase/server";

const DEFAULT_MAX_ROUNDS = 4;

export type WeeklyUpdateResult = {
  status: "updated" | "no_new_round";
  latestStoredRoundBefore: number;
  latestStoredRoundAfter: number;
  nextUnavailableRound: number | null;
  reachedLimit: boolean;
  collections: CollectionResult[];
};

type WeeklyUpdateDependencies = {
  getLatestStoredRound: () => Promise<number>;
  fetchRound: (round: number) => Promise<LotteryShopResponse[]>;
  collectRound: (
    round: number,
    options: { sourceRows: LotteryShopResponse[] },
  ) => Promise<CollectionResult>;
};

async function getLatestStoredRound() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("wins")
    .select("round")
    .order("round", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not read latest stored lottery round: ${error.message}`);
  return (data?.round as number | undefined) ?? 0;
}

const defaultDependencies: WeeklyUpdateDependencies = {
  getLatestStoredRound,
  fetchRound: fetchLotteryRound,
  collectRound: collectLotteryRound,
};

export async function runWeeklyLotteryUpdate(
  options: { maxRounds?: number } = {},
  dependencies: WeeklyUpdateDependencies = defaultDependencies,
): Promise<WeeklyUpdateResult> {
  const maxRounds = options.maxRounds ?? DEFAULT_MAX_ROUNDS;
  if (!Number.isSafeInteger(maxRounds) || maxRounds < 1 || maxRounds > 20) {
    throw new Error("maxRounds must be an integer between 1 and 20");
  }

  const latestStoredRoundBefore = await dependencies.getLatestStoredRound();
  let latestStoredRoundAfter = latestStoredRoundBefore;
  const collections: CollectionResult[] = [];

  for (let index = 0; index < maxRounds; index += 1) {
    const candidateRound = latestStoredRoundAfter + 1;
    const sourceRows = await dependencies.fetchRound(candidateRound);
    if (sourceRows.length === 0) {
      return {
        status: collections.length ? "updated" : "no_new_round",
        latestStoredRoundBefore,
        latestStoredRoundAfter,
        nextUnavailableRound: candidateRound,
        reachedLimit: false,
        collections,
      };
    }

    const result = await dependencies.collectRound(candidateRound, { sourceRows });
    if (result.empty) {
      throw new Error(`Round ${candidateRound} became empty during collection`);
    }
    collections.push(result);
    latestStoredRoundAfter = candidateRound;
  }

  return {
    status: "updated",
    latestStoredRoundBefore,
    latestStoredRoundAfter,
    nextUnavailableRound: null,
    reachedLimit: true,
    collections,
  };
}
