import { ImageResponse } from "next/og";

export const alt = "Lotto Place winning shop map";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "center", padding: "78px", color: "#17201c",
      background: "linear-gradient(135deg, #f5f4ee 0%, #e5f0e9 100%)",
    }}>
      <div style={{ display: "flex", color: "#0f6b4f", fontSize: 28, fontWeight: 800, letterSpacing: 7 }}>
        LOTTO PLACE
      </div>
      <div style={{ display: "flex", marginTop: 28, fontSize: 74, fontWeight: 900, letterSpacing: -2 }}>
        WINNING SHOP MAP
      </div>
      <div style={{ display: "flex", marginTop: 24, color: "#55615b", fontSize: 30 }}>
        First and second prize lottery shops across Korea
      </div>
      <div style={{ display: "flex", marginTop: 70, alignItems: "center", gap: 16 }}>
        <div style={{ width: 22, height: 22, borderRadius: 999, background: "#1688f0", border: "5px solid white", boxShadow: "0 3px 12px #1688f066" }} />
        <div style={{ display: "flex", color: "#0f6b4f", fontSize: 24, fontWeight: 700 }}>lotto.konly.co.kr</div>
      </div>
    </div>,
    size,
  );
}
