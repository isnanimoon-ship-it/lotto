export const LOTTERY_REGIONS = [
  { slug: "seoul", name: "서울" },
  { slug: "busan", name: "부산" },
  { slug: "daegu", name: "대구" },
  { slug: "incheon", name: "인천" },
  { slug: "gwangju", name: "광주" },
  { slug: "daejeon", name: "대전" },
  { slug: "ulsan", name: "울산" },
  { slug: "sejong", name: "세종" },
  { slug: "gyeonggi", name: "경기" },
  { slug: "gangwon", name: "강원" },
  { slug: "chungbuk", name: "충북" },
  { slug: "chungnam", name: "충남" },
  { slug: "jeonbuk", name: "전북" },
  { slug: "jeonnam", name: "전남" },
  { slug: "gyeongbuk", name: "경북" },
  { slug: "gyeongnam", name: "경남" },
  { slug: "jeju", name: "제주" },
] as const;

export type LotteryRegion = (typeof LOTTERY_REGIONS)[number];

export function getLotteryRegion(slug: string) {
  return LOTTERY_REGIONS.find((region) => region.slug === slug);
}
