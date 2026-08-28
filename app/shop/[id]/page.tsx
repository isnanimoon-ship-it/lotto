import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLotteryRegion, LOTTERY_REGIONS } from "../../../lib/map/regions";
import { getShopDetail, parseShopId, type ShopDetailWin } from "../../../lib/map/shop-detail";

export const revalidate = 3600;
export const dynamicParams = true;

type ShopPageProps = PageProps<"/shop/[id]">;

export function generateStaticParams() {
  return [];
}

function displayName(name: string) {
  return name === "-" ? "상호명 미등록" : name;
}

function roundsByRank(wins: ShopDetailWin[], rank: 1 | 2) {
  const counts = new Map<number, number>();
  for (const win of wins) {
    if (win.rank === rank) counts.set(win.round, (counts.get(win.round) ?? 0) + 1);
  }
  return [...counts].map(([round, count]) => ({ round, count }));
}

export async function generateMetadata({ params }: ShopPageProps): Promise<Metadata> {
  const id = parseShopId((await params).id);
  if (!id) return { robots: { index: false, follow: false } };
  const result = await getShopDetail(id);
  if (!result) return { robots: { index: false, follow: false } };
  const { shop } = result;
  const name = displayName(shop.name);
  const title = `${name} 로또 당첨 판매점 정보`;
  const description = `${shop.address}에 위치한 ${name}의 로또 1등 ${shop.shop_stats.first_win_count}건, 2등 ${shop.shop_stats.second_win_count}건과 전체 당첨 회차를 확인하세요.`;
  return {
    title,
    description,
    alternates: { canonical: `/shop/${shop.id}` },
    openGraph: { title, description, url: `/shop/${shop.id}` },
  };
}

export default async function ShopDetailPage({ params }: ShopPageProps) {
  const id = parseShopId((await params).id);
  if (!id) notFound();
  const result = await getShopDetail(id);
  if (!result) notFound();
  const { shop, wins } = result;
  const name = displayName(shop.name);
  const firstRounds = roundsByRank(wins, 1);
  const secondRounds = roundsByRank(wins, 2);
  const region = LOTTERY_REGIONS.find((item) => item.name === shop.region);
  const naverMapUrl = `https://map.naver.com/p/search/${encodeURIComponent(shop.address)}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "LocalBusiness",
        "@id": `https://lotto.konly.co.kr/shop/${shop.id}#shop`,
        name,
        url: `https://lotto.konly.co.kr/shop/${shop.id}`,
        address: shop.address,
        telephone: shop.phone || undefined,
        ...(shop.latitude !== null && shop.longitude !== null ? {
          geo: { "@type": "GeoCoordinates", latitude: shop.latitude, longitude: shop.longitude },
        } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "당첨 판매점 지도", item: "https://lotto.konly.co.kr/map" },
          ...(region ? [{ "@type": "ListItem", position: 2, name: `${region.name} 로또 명당`, item: `https://lotto.konly.co.kr/shops/${region.slug}` }] : []),
          { "@type": "ListItem", position: region ? 3 : 2, name },
        ],
      },
    ],
  };

  const RoundList = ({ title, rank, rounds }: { title: string; rank: 1 | 2; rounds: Array<{ round: number; count: number }> }) => (
    <section className="shop-win-history" aria-labelledby={`rank-${rank}-title`}>
      <div><h2 id={`rank-${rank}-title`}>{title}</h2><span>{rank === 1 ? shop.shop_stats.first_win_count : shop.shop_stats.second_win_count}건</span></div>
      {rounds.length ? <ol>{rounds.map(({ round, count }) => <li key={round}><strong>{round}회</strong>{count > 1 && <em>{count}건</em>}</li>)}</ol> : <p>당첨 이력이 없습니다.</p>}
    </section>
  );

  return (
    <main className="shop-detail-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="shop-breadcrumb" aria-label="현재 위치">
        <Link href="/map">지도</Link><span>›</span>
        {region && <><Link href={`/shops/${region.slug}`}>{region.name}</Link><span>›</span></>}
        <span aria-current="page">{name}</span>
      </nav>
      <header className="shop-detail-hero">
        <p className="eyebrow">LOTTO WINNING SHOP</p>
        <h1>{name}</h1>
        <address>{shop.address}</address>
        <div className="shop-detail-actions">
          <a href={naverMapUrl} target="_blank" rel="noopener noreferrer">네이버 지도에서 보기</a>
          {region && <Link href={`/shops/${region.slug}`}>{region.name} 판매점 더 보기</Link>}
        </div>
      </header>
      <section className="shop-summary" aria-label="당첨 통계">
        <div><span>1등 당첨</span><strong>{shop.shop_stats.first_win_count}</strong><small>건</small></div>
        <div><span>2등 당첨</span><strong>{shop.shop_stats.second_win_count}</strong><small>건</small></div>
        <div><span>전체 당첨</span><strong>{shop.shop_stats.total_win_count}</strong><small>건</small></div>
        <div><span>최근 당첨</span><strong>{shop.shop_stats.last_win_round ?? "-"}</strong><small>{shop.shop_stats.last_win_round ? "회" : ""}</small></div>
      </section>
      <div className="shop-history-grid">
        <RoundList title="1등 당첨 회차" rank={1} rounds={firstRounds} />
        <RoundList title="2등 당첨 회차" rank={2} rounds={secondRounds} />
      </div>
      <section className="shop-basic-info">
        <h2>판매점 정보</h2>
        <dl>
          <div><dt>주소</dt><dd>{shop.address}</dd></div>
          <div><dt>전화번호</dt><dd>{shop.phone || "정보 없음"}</dd></div>
          <div><dt>로또 6/45</dt><dd>{shop.lotto645_enabled ? "판매" : "미판매"}</dd></div>
          <div><dt>연금복권 720+</dt><dd>{shop.pension720_enabled ? "판매" : "미판매"}</dd></div>
        </dl>
      </section>
      <p className="region-disclaimer">표시된 당첨 이력은 과거 데이터이며 향후 당첨을 보장하지 않습니다.</p>
    </main>
  );
}
