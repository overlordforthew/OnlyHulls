import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0c1220 0%, #1a2940 50%, #0e1a2e 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 64, marginRight: 16 }}>⛵</span>
          <span style={{ fontSize: 64, fontWeight: 800, color: "#0ea5e9" }}>Only</span>
          <span style={{ fontSize: 64, fontWeight: 800, color: "#f97316" }}>Hulls</span>
        </div>
        <div style={{ fontSize: 28, color: "#94a3b8", marginBottom: 16 }}>
          The boat marketplace that doesn&apos;t suck.
        </div>
        <div style={{ fontSize: 22, color: "#64748b" }}>
          AI-powered matching · Zero commission · 14,000+ sailboats
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
