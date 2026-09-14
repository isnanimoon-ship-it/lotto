import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFirstPrizeRanking, getFirstPrizeRankingCount, RANKING_PAGE_SIZE } from "../../lib/map/first-ranking";

export const revalidate = 3600;

type RankingPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

function rankingPage(raw: string | string[] | undefined) {
  return typeof raw === "string" && /^[1-9]\d{0,3}$/.test(raw) ? Number(raw) : 1;
}

export async function generateMetadata({ searchParams }: RankingPageProps): Promise<Metadata> {
  const page = rankingPage((await searchParams).page);
  const path = page === 1 ? "/lotto-first" : `/lotto-first?page=${page}`;
  const title = "전국 로또 1등 판매점 순위";
  const description = "역대 로또 1등 당첨자를 가장 많이 배출한 판매점을 실제 1등 당첨 건수 기준으로 확인하세요. 지역, 2등 건수와 최근 당첨 회차도 함께 제공합니다.";
  return {
    title, description, alternates: { canonical: path },
    openGraph: {
      title: `${title} | 로또 플레이스`, description, url: path,
      siteName: "로또 플레이스", locale: "ko_KR", type: "website",
    },
  };
}

export default async function FirstPrizeRankingPage({ searchParams }: RankingPageProps) {
  const page = rankingPage((await searchParams).page);
  const offset = (page - 1) * RANKING_PAGE_SIZE;
  if (page > 1 && offset >= await getFirstPrizeRankingCount()) notFound();
  const { shops, count } = await getFirstPrizeRanking(offset, RANKING_PAGE_SIZE);
  const totalPages = Math.ceil(count / RANKING_PAGE_SIZE);
  if (page > 1 && page > totalPages) notFound();
  const structuredData = {
    "@context": "https://schema.org", "@type": "ItemList",
    name: "전국 로또 1등 판매점 순위",
    numberOfItems: shops.length,
    itemListElement: shops.map((shop, index) => ({
      "@type": "ListItem", position: offset + index + 1,
      name: shop.name, url: `https://lotto.konly.co.kr/shop/${shop.id}`,
    })),
  };
  return (
    <main className="region-page first-ranking-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="region-nav"><Link href="/">← 로또 플레이스 홈</Link></nav>
      <header className="region-hero">
        <p className="eyebrow">LOTTO PLACE · FIRST PRIZE</p>
        <h1>전국 로또 1등 판매점 순위</h1>
        <p>역대 로또 1등 당첨자를 가장 많이 배출한 판매점 <strong>{count.toLocaleString()}곳</strong>을 확인하세요.</p>
      </header>
      <section className="region-ranking" aria-labelledby="first-ranking-title">
        <div className="region-heading">
          <div><p className="eyebrow">FIRST PRIZE RANKING</p><h2 id="first-ranking-title">1등 당첨 건수 순위</h2></div>
          <span>{page} / {totalPages || 1} 페이지</span>
        </div>
        <ol start={offset + 1} style={{ counterReset: `rank ${offset}` }}>
          {shops.map((shop) => (
            <li key={shop.id}>
              <div>
                <h3><Link href={`/shop/${shop.id}`}>{shop.name}</Link></h3>
                <address>{shop.region ? `${shop.region} · ` : ""}{shop.address}</address>
              </div>
              <dl>
                <div className="first-count"><dt>1등</dt><dd>{shop.firstWinCount}</dd></div>
                <div><dt>2등</dt><dd>{shop.secondWinCount}</dd></div>
                <div><dt>전체</dt><dd>{shop.totalWinCount}</dd></div>
                <div><dt>최근 회차</dt><dd>{shop.lastWinRound ? `${shop.lastWinRound}회` : "-"}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
        {shops.length === 0 && <p>해당 순위에 판매점이 없습니다.</p>}
        <nav className="ranking-pagination" aria-label="전국 1등 순위 페이지">
          {page > 1 && <Link href={page === 2 ? "/lotto-first" : `/lotto-first?page=${page - 1}`}>← 이전 50곳</Link>}
          {page < totalPages && <Link href={`/lotto-first?page=${page + 1}`}>다음 50곳 →</Link>}
        </nav>
      </section>
      <p className="region-disclaimer">1등 당첨 건수 내림차순이며, 동률은 2등 건수·최근 당첨 회차 순입니다. 과거 실적은 미래 당첨 확률을 높이지 않습니다.</p>
    </main>
  );
}
