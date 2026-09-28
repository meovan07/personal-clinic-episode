import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// A simple medical cross reads clearly at favicon size, unlike a stethoscope's curves.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1f4d3d",
          borderRadius: 7,
        }}
      >
        <div style={{ position: "relative", width: 16, height: 16, display: "flex" }}>
          <div style={{ position: "absolute", top: 0, left: 6, width: 4, height: 16, background: "#fdfbf4", borderRadius: 2 }} />
          <div style={{ position: "absolute", top: 6, left: 0, width: 16, height: 4, background: "#fdfbf4", borderRadius: 2 }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
