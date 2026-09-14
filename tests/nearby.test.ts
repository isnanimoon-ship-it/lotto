import { describe, expect, it } from "vitest";
import { boundingBox, distanceKm, sortNearby, type NearbyShop } from "../lib/map/nearby";

const shop = (id: number, firstWinCount: number, distance: number, lastFirstWinRound: number | null): NearbyShop => ({
  id, name: String(id), address: "서울", region: "서울", distanceKm: distance,
  firstWinCount, secondWinCount: 0, lastFirstWinRound,
});

describe("nearby search", () => {
  it("calculates the distance and a containing bounding box", () => {
    const center = { lat: 37.5666, lng: 126.978 };
    const point = { lat: 37.5766, lng: 126.978 };
    expect(distanceKm(center, center)).toBe(0);
    expect(distanceKm(center, point)).toBeGreaterThan(1);
    const box = boundingBox(center, 3);
    expect(point.lat).toBeLessThan(box.north);
    expect(center.lng).toBeGreaterThan(box.west);
    expect(center.lng).toBeLessThan(box.east);
  });

  it("sorts first-prize count, distance and latest first-prize round independently", () => {
    const input = [shop(1, 3, 1.5, 1200), shop(2, 7, 2, 1190), shop(3, 2, 0.2, 1240)];
    expect(sortNearby([...input], "first").map((item) => item.id)).toEqual([2, 1, 3]);
    expect(sortNearby([...input], "distance").map((item) => item.id)).toEqual([3, 1, 2]);
    expect(sortNearby([...input], "recent").map((item) => item.id)).toEqual([3, 1, 2]);
  });
});
