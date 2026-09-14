export type Point = { lat: number; lng: number };
export type NearbySort = "first" | "distance" | "recent";
export const NEARBY_RADII = [1, 3, 5, 10] as const;

export function distanceKm(from: Point, to: Point) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const dLat = lat2 - lat1;
  const dLng = radians(to.lng - from.lng);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function boundingBox(center: Point, radiusKm: number) {
  const latitudeSpan = radiusKm / 111.32;
  const longitudeSpan = radiusKm / (111.32 * Math.cos(center.lat * Math.PI / 180));
  return {
    north: center.lat + latitudeSpan,
    south: center.lat - latitudeSpan,
    east: center.lng + longitudeSpan,
    west: center.lng - longitudeSpan,
  };
}

export type NearbyShop = {
  id: number;
  name: string;
  address: string;
  region: string | null;
  distanceKm: number;
  firstWinCount: number;
  secondWinCount: number;
  lastFirstWinRound: number | null;
};

export function sortNearby(shops: NearbyShop[], sort: NearbySort) {
  return shops.sort((a, b) => {
    if (sort === "distance") return a.distanceKm - b.distanceKm || b.firstWinCount - a.firstWinCount || a.id - b.id;
    if (sort === "recent") return (b.lastFirstWinRound ?? 0) - (a.lastFirstWinRound ?? 0)
      || b.firstWinCount - a.firstWinCount || a.distanceKm - b.distanceKm || a.id - b.id;
    return b.firstWinCount - a.firstWinCount || a.distanceKm - b.distanceKm || a.id - b.id;
  });
}
