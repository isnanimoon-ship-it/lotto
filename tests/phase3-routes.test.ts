import { describe, expect, it } from "vitest";
import { municipalitySlug } from "../lib/map/municipalities";
import { drawDate, parseLotteryRound } from "../lib/map/rounds";

describe("Phase 3 URL helpers", () => {
  it("uses stable English slugs for known municipalities and preserves unknown names", () => {
    expect(municipalitySlug("서울", "강남구")).toBe("gangnam");
    expect(municipalitySlug("부산", "해운대구")).toBe("haeundae");
    expect(municipalitySlug("경기", "양평군")).toBe("양평군");
  });

  it("accepts valid rounds and computes the weekly draw date", () => {
    expect(parseLotteryRound("1241")).toBe(1241);
    expect(parseLotteryRound("0")).toBeNull();
    expect(parseLotteryRound("1abc")).toBeNull();
    expect(drawDate(1).toISOString().slice(0, 10)).toBe("2002-12-07");
    expect(drawDate(1241).toISOString().slice(0, 10)).toBe("2026-09-12");
  });
});
