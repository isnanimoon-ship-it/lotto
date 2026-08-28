import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "../../../lib/supabase/server";
import { getLotteryRegion, LOTTERY_REGIONS } from "../../../lib/map/regions";

export const revalidate = 3600;
export const dynamicParams = false;

type RegionPageProps = PageProps<"/shops/[region]">;

type RegionShop = {
  id: number;
  name: string;
  address: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  shop_stats: {
    first_win_count: number;
    second_win_count: number;
    total_win_count: number;
    last_win_round: number | null;
  };
};

type RegionRankingRow = RegionShop["shop_stats"] & {
  shop_id: number;
  shops: Omit<RegionShop, "shop_stats"> | Array<Omit<RegionShop, "shop_stats">>;
};

export function generateStaticParams() {
  return LOTTERY_REGIONS.map(({ slug }) => ({ region: slug }));
}

export async function generateMetadata({ params }: RegionPageProps): Promise<Metadata> {
  const { region: slug } = await params;
  const region = getLotteryRegion(slug);
  if (!region) return {};
  const title = `${region.name} 로또 명당과 1등·2등 당첨 판매점`;
  const description = `${region.name} 지역 로또 1등·2등 당첨 판매점의 당첨 횟수, 주소와 최근 당첨 회차를 확인하세요.`;
  return {
    title,
    description,
    alternates: { canonical: `/shops/${region.slug}` },
    openGraph: { title, description, url: `/shops/${region.slug}` },
  };
}

async function getRegionShops(regionName: string) {
  const supabase = createServerSupabaseClient();
  const [countResult, rankingResult] = await Promise.all([
    supabase.from("shops").select("id", { count: "exact", head: true }).eq("region", regionName),
    supabase
      .from("shop_stats")
      .select("shop_id,first_win_count,second_win_count,total_win_count,last_win_round,shops!inner(id,name,address,phone,latitude,longitude,region)")
      .eq("shops.region", regionName)
      .order("total_win_count", { ascending: false })
      .order("first_win_count", { ascending: false })
      .order("last_win_round", { ascending: false, nullsFirst: false })
      .order("shop_id", { ascending: true })
      .limit(30),
  ]);
  if (countResult.error) throw new Error(`Could not count ${regionName} shops: ${countResult.error.message}`);
  if (rankingResult.error) throw new Error(`Could not rank ${regionName} shops: ${rankingResult.error.message}`);
  const shops = ((rankingResult.data ?? []) as unknown as RegionRankingRow[]).map((row) => {
    const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;
    return {
      ...shop,
      shop_stats: {
        first_win_count: row.first_win_count,
        second_win_count: row.second_win_count,
        total_win_count: row.total_win_count,
        last_win_round: row.last_win_round,
      },
    };
  });
  return { shops, count: countResult.count ?? 0 };
}

export default async function RegionShopsPage({ params }: RegionPageProps) {
  const { region: slug } = await params;
  const region = getLotteryRegion(slug);
  if (!region) notFound();
  const { shops, count } = await getRegionShops(region.name);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${region.name} 로또 당첨 판매점`,
    numberOfItems: shops.length,
    itemListElement: shops.map((shop, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "LocalBusiness",
        name: shop.name === "-" ? "상호명 미등록" : shop.name,
        address: shop.address,
        telephone: shop.phone || undefined,
        ...(shop.latitude !== null && shop.longitude !== null ? {
          geo: { "@type": "GeoCoordinates", latitude: shop.latitude, longitude: shop.longitude },
        } : {}),
      },
    })),
  };

  return (
    <main className="region-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="region-nav" aria-label="주요 페이지">
        <Link href="/map">← 지도에서 찾기</Link>
      </nav>
      <header className="region-hero">
        <p className="eyebrow">LOTTO PLACE · {region.name.toUpperCase()}</p>
        <h1>{region.name} 로또 명당</h1>
        <p>{region.name} 지역의 로또 1등·2등 당첨 판매점 <strong>{count.toLocaleString()}곳</strong>을 확인하세요.</p>
      </header>
      <section className="region-ranking" aria-labelledby="ranking-title">
        <div className="region-heading">
          <div><p className="eyebrow">WINNING RECORDS</p><h2 id="ranking-title">당첨 실적 상위 판매점</h2></div>
          <span>최대 30곳</span>
        </div>
        <ol>
          {shops.map((shop) => (
            <li key={shop.id}>
              <div>
                <h3><Link href={`/shop/${shop.id}`}>{shop.name === "-" ? "상호명 미등록" : shop.name}</Link></h3>
                <address>{shop.address}</address>
              </div>
              <dl>
                <div><dt>1등</dt><dd>{shop.shop_stats.first_win_count}</dd></div>
                <div><dt>2등</dt><dd>{shop.shop_stats.second_win_count}</dd></div>
                <div><dt>전체</dt><dd>{shop.shop_stats.total_win_count}</dd></div>
                <div><dt>최근 회차</dt><dd>{shop.shop_stats.last_win_round ? `${shop.shop_stats.last_win_round}회` : "-"}</dd></div>
              </dl>
            </li>
          ))}
        </ol>
      </section>
      <nav className="region-links" aria-label="다른 지역 당첨 판매점">
        <h2>다른 지역 보기</h2>
        <div>{LOTTERY_REGIONS.map((item) => <Link key={item.slug} href={`/shops/${item.slug}`} aria-current={item.slug === region.slug ? "page" : undefined}>{item.name}</Link>)}</div>
      </nav>
      <p className="region-disclaimer">표시된 당첨 이력은 과거 데이터이며 향후 당첨을 보장하지 않습니다.</p>
    </main>
  );
}
