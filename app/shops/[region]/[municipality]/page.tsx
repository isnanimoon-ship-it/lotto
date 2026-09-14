import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLotteryRegion } from "../../../../lib/map/regions";
import { getMunicipalities, resolveMunicipality } from "../../../../lib/map/municipalities";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type Props = { params: Promise<{ region: string; municipality: string }> };

async function getRanking(regionName: string, name: string) {
  const supabase = createServerSupabaseClient();
  const { data, count, error } = await supabase.from("shop_stats")
    .select("shop_id,first_win_count,second_win_count,total_win_count,last_win_round,shops!inner(id,name,address,region,city)", { count: "exact" })
    .eq("shops.region", regionName).eq("shops.city", name)
    .gt("first_win_count", 0)
    .order("first_win_count", { ascending: false })
    .order("second_win_count", { ascending: false })
    .order("shop_id", { ascending: true })
    .limit(50);
  if (error) throw new Error(`Could not load ${regionName} ${name} ranking: ${error.message}`);
  return {
    count: count ?? 0,
    shops: (data ?? []).map((row) => {
      const shop = Array.isArray(row.shops) ? row.shops[0] : row.shops;
      return {
        id: shop.id, name: shop.name === "-" ? "상호명 미등록" : shop.name,
        address: shop.address, first: row.first_win_count,
        second: row.second_win_count, total: row.total_win_count,
        recent: row.last_win_round,
      };
    }),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { region: regionSlug, municipality: slug } = await params;
  const region = getLotteryRegion(regionSlug);
  const municipality = region && await resolveMunicipality(regionSlug, slug);
  if (!region || !municipality) return { robots: { index: false, follow: false } };
  const title = `${municipality.name} 로또 1등 판매점 · 명당 순위`;
  const description = `${region.name} ${municipality.name}에서 로또 1등 당첨자를 배출한 판매점을 실제 당첨 건수 순으로 확인하세요.`;
  const path = `/shops/${regionSlug}/${encodeURIComponent(slug)}`;
  return { title, description, alternates: { canonical: path },
    openGraph: { title: `${title} | 로또 플레이스`, description, url: path, siteName: "로또 플레이스", locale: "ko_KR", type: "website" } };
}

export default async function MunicipalityPage({ params }: Props) {
  const { region: regionSlug, municipality: slug } = await params;
  const region = getLotteryRegion(regionSlug);
  const municipality = region && await resolveMunicipality(regionSlug, slug);
  if (!region || !municipality) notFound();
  const [{ shops, count }, siblings] = await Promise.all([
    getRanking(region.name, municipality.name),
    getMunicipalities(regionSlug),
  ]);
  const pageUrl = `https://lotto.konly.co.kr/shops/${regionSlug}/${encodeURIComponent(slug)}`;
  const structuredData = {
    "@context": "https://schema.org", "@graph": [
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "로또 플레이스", item: "https://lotto.konly.co.kr/" },
        { "@type": "ListItem", position: 2, name: region.name, item: `https://lotto.konly.co.kr/shops/${regionSlug}` },
        { "@type": "ListItem", position: 3, name: municipality.name, item: pageUrl },
      ] },
      { "@type": "ItemList", name: `${municipality.name} 로또 1등 판매점 순위`, numberOfItems: shops.length,
        itemListElement: shops.map((shop, index) => ({
          "@type": "ListItem", position: index + 1, name: shop.name,
          url: `https://lotto.konly.co.kr/shop/${shop.id}`,
        })) },
    ],
  };
  return (
    <main className="region-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="region-nav" aria-label="현재 위치"><Link href="/">로또 플레이스</Link> › <Link href={`/shops/${regionSlug}`}>{region.name}</Link> › {municipality.name}</nav>
      <header className="region-hero">
        <p className="eyebrow">LOTTO PLACE · LOCAL RANKING</p>
        <h1>{municipality.name} 로또 1등 판매점 · 로또 명당 순위</h1>
        <p>{region.name} {municipality.name}의 1등 당첨 이력이 있는 판매점 <strong>{count.toLocaleString()}곳</strong>을 1등 건수 기준으로 비교합니다.</p>
      </header>
      <section className="region-ranking" aria-labelledby="municipality-ranking-title">
        <div className="region-heading"><div><p className="eyebrow">FIRST PRIZE RECORDS</p><h2 id="municipality-ranking-title">1등 당첨 실적 상위 판매점</h2></div><span>최대 50곳</span></div>
        <ol>{shops.map((shop) => <li key={shop.id}>
          <div><h3><Link href={`/shop/${shop.id}`}>{shop.name}</Link></h3><address>{shop.address}</address></div>
          <dl><div><dt>1등</dt><dd>{shop.first}</dd></div><div><dt>2등</dt><dd>{shop.second}</dd></div><div><dt>전체</dt><dd>{shop.total}</dd></div><div><dt>최근 회차</dt><dd>{shop.recent ? `${shop.recent}회` : "-"}</dd></div></dl>
        </li>)}</ol>
        {shops.length === 0 && <p>이 지역에 1등 당첨 이력이 등록된 판매점이 없습니다.</p>}
      </section>
      <nav className="region-links" aria-label="같은 지역 시군구"><h2>{region.name} 다른 지역 보기</h2><div>
        {siblings.map((item) => <Link key={item.slug} href={`/shops/${regionSlug}/${encodeURIComponent(item.slug)}`} aria-current={item.slug === slug ? "page" : undefined}>{item.name}</Link>)}
      </div></nav>
      <p className="region-disclaimer">과거 당첨 이력은 미래 당첨 확률을 높여주지 않습니다.</p>
    </main>
  );
}
