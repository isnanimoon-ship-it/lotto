import type { Metadata } from "next";
import Link from "next/link";
import { LOTTERY_REGIONS } from "../../lib/map/regions";

export const metadata: Metadata = {
  title: "지역별 로또 1등 판매점 순위",
  description: "서울·부산·경기 등 전국 지역별 로또 1등 당첨 판매점 순위를 확인하고 시·군·구까지 좁혀보세요.",
  alternates: { canonical: "/regions" },
  openGraph: { title: "지역별 로또 1등 판매점 순위 | 로또 플레이스", url: "/regions", siteName: "로또 플레이스", locale: "ko_KR", type: "website" },
};

export default function RegionsPage() {
  return <main className="utility-page regions-index">
    <div className="utility-intro">
      <p className="eyebrow">LOTTO PLACE · REGIONS</p>
      <h1>지역별 로또 1등 판매점 순위</h1>
      <p>관심 지역을 선택해 실제 1등 당첨 건수가 많은 판매점을 확인하세요. 지역 페이지에서 시·군·구까지 좁힐 수 있습니다.</p>
    </div>
    <nav className="regions-index-grid" aria-label="지역별 1등 판매점 순위">
      {LOTTERY_REGIONS.map(({ slug, name }) =>
        <Link key={slug} href={`/shops/${slug}`}><strong>{name}</strong><span>1등 판매점 순위 보기 →</span></Link>,
      )}
    </nav>
    <p className="region-disclaimer">과거 당첨 이력은 미래 당첨 확률을 높여주지 않습니다.</p>
  </main>;
}
