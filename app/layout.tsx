import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://lotto.konly.co.kr"),
  title: {
    default: "로또 명당 지도 | 로또 플레이스",
    template: "%s | 로또 플레이스",
  },
  description: "전국 로또 1등·2등 당첨 판매점과 당첨 회차를 지도에서 확인하고 현재 위치 주변 판매점을 찾아보세요.",
  applicationName: "로또 플레이스",
  keywords: ["로또 명당", "로또 당첨 판매점", "로또 1등 판매점", "로또 2등 판매점", "로또 지도"],
  alternates: { canonical: "/map" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/map",
    siteName: "로또 플레이스",
    title: "로또 명당 지도 | 로또 플레이스",
    description: "전국 로또 1등·2등 당첨 판매점과 당첨 회차를 지도에서 확인하세요.",
  },
  twitter: {
    card: "summary_large_image",
    title: "로또 명당 지도 | 로또 플레이스",
    description: "전국 로또 1등·2등 당첨 판매점을 지도에서 확인하세요.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        {children}
        <Script src="https://wcs.pstatic.net/wcslog.js" strategy="afterInteractive" />
        <Script id="naver-analytics" strategy="afterInteractive">
          {`
            function initializeNaverAnalytics() {
              if (!window.wcs_add) window.wcs_add = {};
              window.wcs_add["wa"] = "1aaee28bc70bf40";
              if (window.wcs) {
                window.wcs_do();
              }
            }

            if (window.wcs) {
              initializeNaverAnalytics();
            } else {
              var naverAnalyticsScript = document.querySelector(
                'script[src="https://wcs.pstatic.net/wcslog.js"]'
              );
              if (naverAnalyticsScript) {
                naverAnalyticsScript.addEventListener(
                  "load",
                  initializeNaverAnalytics,
                  { once: true }
                );
              }
            }
          `}
        </Script>
      </body>
    </html>
  );
}
