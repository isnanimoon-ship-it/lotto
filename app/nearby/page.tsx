import type { Metadata } from "next";
import Link from "next/link";
import { NearbyFinder } from "../../components/nearby-finder";

export const metadata: Metadata = {
  title: "내 주변 로또 1등 당첨 판매점 찾기",
  description: "현재 위치에서 1·3·5·10km 이내의 로또 1등 당첨 판매점을 실제 당첨 건수, 거리, 최근 1등 회차 순으로 비교하세요.",
  alternates: { canonical: "/nearby" },
  openGraph: { title: "내 주변 로또 1등 당첨 판매점 찾기 | 로또 플레이스", url: "/nearby", siteName: "로또 플레이스", locale: "ko_KR", type: "website" },
};

export default function NearbyPage() {
  return <main className="utility-page">
    <div className="utility-intro">
      <p className="eyebrow">LOTTO PLACE · NEARBY</p>
      <h1>내 주변 로또 1등 판매점 찾기</h1>
      <p>현재 위치를 허용하면 가까운 판매점을 실제 당첨 기록과 함께 비교할 수 있습니다.</p>
      <Link href="/#map-section">주소·지역으로 지도에서 찾기 →</Link>
    </div>
    <NearbyFinder />
  </main>;
}
