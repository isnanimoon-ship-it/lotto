import type { Metadata } from "next";
import Link from "next/link";
import { LotteryMap } from "../components/lottery-map";
import { getFirstPrizeRanking } from "../lib/map/first-ranking";
import { getRecentRounds } from "../lib/map/rounds";

const SITE_URL = "https://lotto.konly.co.kr";
const description = "전국 로또 1·2등 실제 당첨 판매점 데이터를 기반으로 내 주변 로또 명당과 1등 최다 당첨 판매점을 지도와 순위로 확인하세요.";

export const metadata: Metadata = {
  title: { absolute: "내 주변 로또 1등 명당 찾기 | 로또 플레이스" },
  description,
  alternates: { canonical: "/" },
  openGraph: { type: "website", locale: "ko_KR", url: "/", siteName: "로또 플레이스", title: "내 주변 로또 1등 명당 찾기 | 로또 플레이스", description },
  twitter: { card: "summary_large_image", title: "내 주변 로또 1등 명당 찾기 | 로또 플레이스", description },
};

const websiteStructuredData = {
  "@context": "https://schema.org", "@type": "WebSite",
  "@id": `${SITE_URL}/#website`, name: "로또 플레이스",
  alternateName: ["로또플레이스", "Lotto Place", "lotto.konly.co.kr"],
  url: `${SITE_URL}/`, description: "전국 로또 1등·2등 당첨 판매점과 당첨 이력을 지도에서 확인하는 서비스",
  inLanguage: "ko-KR",
};

export const revalidate = 3600;

export default async function HomePage() {
  const [{ shops: leaders }, recentRounds] = await Promise.all([
    getFirstPrizeRanking(0, 5), getRecentRounds(1),
  ]);
  const latestRound = recentRounds[0] ?? null;
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }} />
    <section className="home-hero" aria-labelledby="home-title">
      <p className="eyebrow">로또 플레이스 · LOTTO PLACE</p>
      <h1 id="home-title">내 주변 로또 1등 명당 찾기</h1>
      <p>실제 당첨 이력을 지도에서 확인하고, 가까운 판매점의 위치와 1등 건수를 비교하세요.</p>
      <div className="home-hero-actions">
        <Link className="hero-button hero-button-primary" href="/nearby">내 주변 검색</Link>
        <a className="hero-button hero-button-secondary" href="#map-section">지도 바로 보기</a>
      </div>
    </section>

    <section id="map-section" className="home-map-section" aria-label="로또 당첨 판매점 지도">
      <LotteryMap />
    </section>

    <section className="home-content home-highlights" aria-labelledby="home-ranking-title">
      <div className="home-section-heading">
        <div><p className="eyebrow">FIRST PRIZE RECORDS</p><h2 id="home-ranking-title">전국 1등 판매점 TOP 5</h2></div>
        <Link href="/lotto-first">전체 순위 보기 →</Link>
      </div>
      <ol className="home-top-list">{leaders.map((shop) => <li key={shop.id}>
        <Link href={`/shop/${shop.id}`}><strong>{shop.name}</strong><span>{shop.region} · {shop.address}</span><b>1등 {shop.firstWinCount}건</b></Link>
      </li>)}</ol>
      <div className="home-more-links">
        <Link href="/regions">지역별 1등 순위 →</Link>
        {latestRound && <Link href={`/round/${latestRound}`}>최근 {latestRound}회 당첨 판매점 →</Link>}
        <Link href="/guide/lotto-first-prize-shop">서비스 이용 안내 →</Link>
      </div>
    </section>

    <section className="home-about" aria-labelledby="home-about-title">
      <h2 id="home-about-title">실제 당첨 기록으로 확인하는 판매점</h2>
      <p>로또 플레이스는 로또 6/45 1등·2등 판매점의 위치와 과거 당첨 건수를 제공합니다. 과거 이력은 참고 정보이며 미래 당첨 확률을 높여주지 않습니다.</p>
      <Link href="/guide/lotto-myeongdang">로또 명당이란? →</Link>
    </section>
  </>;
}
