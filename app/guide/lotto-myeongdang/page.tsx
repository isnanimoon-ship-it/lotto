import type { Metadata } from "next";
import Link from "next/link";

const title = "로또 명당이란? 1등 최다 당첨 판매점 확인하는 방법";
const description = "로또 명당의 의미와 1등·2등 당첨 건수의 차이, 판매점 순위를 해석할 때 주의할 점을 알아보세요.";

export const metadata: Metadata = {
  title, description, alternates: { canonical: "/guide/lotto-myeongdang" },
  openGraph: { title: `${title} | 로또 플레이스`, description, url: "/guide/lotto-myeongdang", siteName: "로또 플레이스", locale: "ko_KR", type: "article" },
};

export default function LottoMyeongdangGuidePage() {
  return (
    <main className="guide-page">
      <nav className="region-nav"><Link href="/">로또 플레이스 홈</Link> › 로또 명당이란?</nav>
      <header className="guide-hero"><p className="eyebrow">LOTTO PLACE GUIDE</p><h1>{title}</h1><p>“명당”이라는 표현을 실제 당첨 기록과 분리해 이해해 보세요.</p></header>
      <article className="guide-body">
        <section><h2>로또 명당은 공식 등급이 아닙니다</h2><p>“로또 명당”은 과거에 당첨 복권이 많이 판매된 곳을 가리킬 때 쓰는 일상적인 표현입니다. 판매점을 평가하는 공식 등급이나 향후 당첨 가능성을 뜻하지 않습니다.</p></section>
        <section><h2>1등 최다와 전체 당첨은 다릅니다</h2><p><Link href="/lotto-first">전국 1등 판매점 순위</Link>는 1등 당첨 건수를 기준으로 합니다. 1등과 2등의 합계가 높은 판매점이 반드시 1등 건수에서도 가장 높은 것은 아닙니다.</p></section>
        <section><h2>같은 회차에 여러 건 당첨되면?</h2><p>한 판매점에서 같은 회차에 같은 등수의 당첨 복권이 여러 장 판매될 수 있습니다. 이 경우 각각 별도 건으로 기록합니다. 판매점 상세에서 회차별 건수를 확인하고 회차 페이지로 이동할 수 있습니다.</p></section>
        <section><h2>가까운 판매점 찾기</h2><p><Link href="/nearby">내 주변 검색</Link>에서 반경과 정렬을 선택하거나, <Link href="/#map-section">지도</Link>에서 주소·지역으로 찾아보세요.</p></section>
        <section><h2>당첨 확률에 대한 주의</h2><p>과거 당첨 이력은 참고 정보이며 특정 판매점의 미래 당첨 확률을 높여주는 것은 아닙니다. 기록이 많은 곳을 방문해도 다음 복권 결과를 예측할 수는 없습니다.</p><p><Link href="/guide/lotto-first-prize-shop">전국·지역별 1등 판매점 찾는 방법 보기</Link></p></section>
      </article>
    </main>
  );
}
