export type MapShop = {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  firstWinCount: number;
  secondWinCount: number;
  totalWinCount: number;
  lastWinRound: number | null;
};

export type MapShopsResponse =
  | { mode: "markers"; count: number; shops: MapShop[] }
  | { mode: "too_many_results"; count: number; shops: [] }
  | { mode: "zoom_in"; count: 0; shops: [] };

export type ShopWin = {
  round: number;
  rank: 1 | 2;
  occurrence: number;
};

export type ShopWinsResponse = {
  shopId: number;
  wins: ShopWin[];
};
