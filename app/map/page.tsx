import type { Metadata } from "next";
import Link from "next/link";
import { LotteryMap } from "../../components/lottery-map";
import { LOTTERY_REGIONS } from "../../lib/map/regions";

export const metadata: Metadata = {
  title: "전국 로또 1등·2등 당첨 판매점 지도",
  description: "전국 로또 당첨 판매점의 1등·2등 횟수와 전체 당첨 회차를 지도에서 확인하고 주소나 현재 위치로 주변 판매점을 찾아보세요.",
  alternates: { canonical: "/map" },
};

export default function MapPage() {
  return (
    <>
      <LotteryMap />
      <section className="seo-intro" aria-labelledby="service-guide-title">
        <p className="eyebrow">LOTTO PLACE GUIDE</p>
        <h2 id="service-guide-title">전국 로또 당첨 판매점을 한눈에 확인하세요</h2>
        <p>
          로또 플레이스는 동행복권의 로또 6/45 1등·2등 당첨 판매점 데이터를 기반으로
          판매점 위치와 실제 당첨 건수, 전체 당첨 회차를 지도에서 제공합니다.
        </p>
        <div className="seo-features">
          <article>
            <h3>지역별 당첨 판매점</h3>
            <p>서울, 부산, 경기 등 원하는 지역으로 이동해 현재 지도 범위의 당첨 판매점을 확인할 수 있습니다.</p>
          </article>
          <article>
            <h3>전체 당첨 이력</h3>
            <p>판매점 마커를 선택하면 1등·2등 당첨 건수와 당첨이 발생한 전체 회차를 확인할 수 있습니다.</p>
          </article>
          <article>
            <h3>내 주변 판매점 찾기</h3>
            <p>현재 위치 또는 도로명·지번 주소를 기준으로 주변 판매점을 찾고 가까운 순서로 비교할 수 있습니다.</p>
          </article>
        </div>
        <nav className="seo-region-links" aria-label="지역별 로또 당첨 판매점">
          <h3>지역별 당첨 판매점</h3>
          <div>{LOTTERY_REGIONS.map(({ slug, name }) => <Link key={slug} href={`/shops/${slug}`}>{name}</Link>)}</div>
        </nav>
        <p className="seo-notice">당첨 이력은 판매점의 과거 실적이며 향후 당첨을 보장하지 않습니다.</p>
      </section>
    </>
  );
}
