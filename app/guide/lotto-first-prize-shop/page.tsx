import type { Metadata } from "next";
import Link from "next/link";
import { LOTTERY_REGIONS } from "../../../lib/map/regions";

const title = "로또 1등 판매점 찾는 방법 - 전국·지역별 명당 조회";
const description = "실제 1등 당첨 건수로 전국 순위를 비교하고, 지역별 순위와 내 주변 판매점을 찾는 방법을 알아보세요.";
const faq = [
  { question: "로또 1등 판매점 순위는 무엇을 기준으로 하나요?", answer: "판매점별 실제 1등 당첨 건수를 기준으로 합니다. 같은 회차의 복수 당첨도 각각 별도 건수로 계산합니다." },
  { question: "가까운 판매점은 어떻게 찾나요?", answer: "내 주변 검색 페이지에서 위치 사용을 허용하고 1km, 3km, 5km, 10km 반경을 선택하세요. 위치를 사용할 수 없다면 지도에서 주소나 지역을 검색할 수 있습니다." },
  { question: "과거 1등 당첨이 많으면 다음 회차에도 유리한가요?", answer: "아닙니다. 과거 당첨 이력은 참고 정보이며 특정 판매점의 미래 당첨 확률을 높여주지 않습니다." },
];

export const metadata: Metadata = {
  title, description, alternates: { canonical: "/guide/lotto-first-prize-shop" },
  openGraph: { title: `${title} | 로또 플레이스`, description, url: "/guide/lotto-first-prize-shop", siteName: "로또 플레이스", locale: "ko_KR", type: "article" },
};

export default function FirstPrizeGuidePage() {
  const structuredData = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map(({ question, answer }) => ({
      "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
  return (
    <main className="guide-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }} />
      <nav className="region-nav"><Link href="/">로또 플레이스 홈</Link> › 로또 1등 판매점 찾는 방법</nav>
      <header className="guide-hero"><p className="eyebrow">LOTTO PLACE GUIDE</p><h1>{title}</h1><p>판매점별 과거 당첨 이력을 어디에서 어떻게 비교할지 안내합니다.</p></header>
      <article className="guide-body">
        <section><h2>로또 1등 판매점이란?</h2><p>동행복권 로또 6/45에서 1등 당첨 복권이 판매된 곳입니다. 같은 판매점이 같은 회차에 같은 등수로 여러 번 등장하면 각각 독립적인 당첨 건으로 셉니다.</p></section>
        <section><h2>전국 1등 판매점 순위</h2><p><Link href="/lotto-first">전국 순위</Link>에서 실제 1등 당첨 건수 기준으로 판매점을 비교하세요. 2등 건수와 최근 회차도 함께 볼 수 있습니다.</p></section>
        <section><h2>지역별 판매점 순위</h2><p>지역 페이지에서는 1등 당첨 판매점을 지역과 시·군·구 단위로 좁혀 볼 수 있습니다.</p><nav className="guide-region-links" aria-label="지역별 1등 판매점 순위">{LOTTERY_REGIONS.map(({ slug, name }) => <Link key={slug} href={`/shops/${slug}`}>{name}</Link>)}</nav></section>
        <section><h2>내 주변 로또 명당 찾기</h2><p><Link href="/nearby">내 주변 검색</Link>에서 위치를 허용하고 반경과 정렬 기준을 선택하세요. 위치를 사용할 수 없다면 <Link href="/#map-section">지도에서 주소·지역을 검색</Link>할 수 있습니다.</p></section>
        <section><h2>과거 실적을 해석할 때</h2><p>과거 당첨 이력은 참고 정보이며 특정 판매점의 미래 당첨 확률을 높여주지 않습니다. “명당”은 당첨을 보장하는 공식 등급이 아닙니다.</p><p><Link href="/guide/lotto-myeongdang">로또 명당의 의미 더 알아보기</Link></p></section>
        <section><h2>자주 묻는 질문</h2><div className="guide-faq">{faq.map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
      </article>
    </main>
  );
}
