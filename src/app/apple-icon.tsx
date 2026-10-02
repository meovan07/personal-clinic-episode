import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS applies its own corner-rounding to home-screen icons, so this stays square.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f5d8f",
        }}
      >
        <div style={{ position: "relative", width: 90, height: 90, display: "flex" }}>
          <div style={{ position: "absolute", top: 0, left: 33, width: 24, height: 90, background: "#ffffff", borderRadius: 12 }} />
          <div style={{ position: "absolute", top: 33, left: 0, width: 90, height: 24, background: "#ffffff", borderRadius: 12 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
