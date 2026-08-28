import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "로또 명당 지도",
  description: "전국 로또 1등·2등 당첨 판매점을 지도에서 확인하세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
