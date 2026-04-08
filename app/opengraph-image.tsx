import { ImageResponse } from "next/og"

export const runtime = "edge"
export const dynamic = "force-static"
export const alt = "nodepad — spatial AI research tool"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          background: "#0a0a0a",
          padding: "80px 96px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Logo mark */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "48px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{ width: 28, height: 28, borderRadius: 5, background: "#3ecf6e" }} />
            <div style={{ width: 28, height: 28, borderRadius: 5, background: "#3ecf6e", opacity: 0.6 }} />
            <div style={{ width: 28, height: 28, borderRadius: 5, background: "#3ecf6e", opacity: 0.3 }} />
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, color: "#f0f0f0", letterSpacing: "-0.5px" }}>
            nodepad
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: "#f0f0f0",
            lineHeight: 1.05,
            letterSpacing: "-2px",
            marginBottom: 32,
          }}
        >
          Think spatially.
          <br />
          <span style={{ color: "#3ecf6e" }}>Let AI fill the gaps.</span>
        </div>

        {/* Subline */}
        <div style={{ fontSize: 24, color: "#666", fontWeight: 400, letterSpacing: "-0.3px" }}>
          nodepad.space
        </div>
      </div>
    ),
    { ...size },
  )
}
