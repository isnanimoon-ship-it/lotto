import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { drawDate, getRoundShops, parseLotteryRound } from "../../../lib/map/rounds";
import { LOTTERY_REGIONS } from "../../../lib/map/regions";

export const revalidate = 3600;
export const dynamicParams = true;
export function generateStaticParams() { return []; }

type Props = { params: Promise<{ round: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const round = parseLotteryRound((await params).round);
  if (!round || !(await getRoundShops(round))) return { robots: { index: false, follow: false } };
  const title = `${round}회 로또 1등 당첨 판매점 · 당첨지역`;
  const description = `${round}회 로또 1등·2등 당첨 판매점의 지역, 주소와 판매점별 역대 당첨 건수를 확인하세요.`;
  return { title, description, alternates: { canonical: `/round/${round}` },
    openGraph: { title: `${title} | 로또 플레이스`, description, url: `/round/${round}`, siteName: "로또 플레이스", locale: "ko_KR", type: "website" } };
}

export default async function RoundPage({ params }: Props) {
  const round = parseLotteryRound((await params).round);
  if (!round) notFound();
  const wins = await getRoundShops(round);
  if (!wins) notFound();
  const first = wins.filter((win) => win.rank === 1);
  const second = wins.filter((win) => win.rank === 2);
  const date = drawDate(round).toLocaleDateString("ko-KR", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" });
  const structuredData = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "로또 플레이스", item: "https://lotto.konly.co.kr/" },
      { "@type": "ListItem", position: 2, name: `${round}회 로또 1등 당첨 판매점`, item: `https://lotto.konly.co.kr/round/${round}` },
    ],
  };
  const WinList = ({ rows, rank }: { rows: typeof wins; rank: 1 | 2 }) => (
    <section className="region-ranking round-ranking" aria-labelledby={`round-rank-${rank}`}>
      <div className="region-heading"><div><p className="eyebrow">ROUND {round} · RANK {rank}</p><h2 id={`round-rank-${rank}`}>{rank}등 당첨 판매점</h2></div><span>{rows.length}건</span></div>
      <ol>{rows.map((win, index) => {
        const region = LOTTERY_REGIONS.find((item) => item.name === win.shop.region);
        return <li key={`${win.shop.id}-${win.occurrence}-${index}`}>
          <div><h3><Link href={`/shop/${win.shop.id}`}>{win.shop.name}</Link></h3><address>{region && <Link href={`/shops/${region.slug}`}>{region.name}</Link>} {win.shop.address}</address></div>
          <dl><div><dt>역대 1등</dt><dd>{win.shop.firstWinCount}</dd></div><div><dt>역대 2등</dt><dd>{win.shop.secondWinCount}</dd></div></dl>
        </li>;
      })}</ol>
    </section>
  );
  return (
    <main className="region-page round-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="region-nav"><Link href="/">로또 플레이스 홈</Link> › {round}회</nav>
      <header className="region-hero"><p className="eyebrow">LOTTO 6/45 · ROUND {round}</p><h1>{round}회 로또 1등 당첨 판매점</h1>
        <p>추첨일 {date} · 1등 <strong>{first.length}건</strong> · 2등 <strong>{second.length}건</strong></p>
      </header>
      <WinList rows={first} rank={1} />
      <WinList rows={second} rank={2} />
      <p className="region-disclaimer">동일 판매점의 같은 등수 복수 당첨은 각각 별도 건수로 표시합니다. 자동·수동 정보는 제공 데이터에 없어 표기하지 않습니다.</p>
    </main>
  );
}
