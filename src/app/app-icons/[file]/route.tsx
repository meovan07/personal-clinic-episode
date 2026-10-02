import { ImageResponse } from "next/og";

// Home-screen icons for the web app manifest, drawn like icon.tsx/apple-icon.tsx (white cross on clinic green).
// "maskable" leaves a wider margin because Android crops those icons into circles or squircles.
const ICONS: Record<string, { size: number; cross: number; rounded: boolean }> = {
  "192.png": { size: 192, cross: 96, rounded: true },
  "512.png": { size: 512, cross: 256, rounded: true },
  "maskable-512.png": { size: 512, cross: 200, rounded: false },
};

export const dynamic = "force-static";

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/app-icons/[file]">) {
  const icon = ICONS[(await params).file];
  if (!icon) return new Response("Not found", { status: 404 });
  const { size, cross, rounded } = icon;
  const bar = Math.round(cross * 0.27);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1f4d3d",
        borderRadius: rounded ? size * 0.22 : 0,
      }}
    >
      <div style={{ position: "relative", width: cross, height: cross, display: "flex" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: (cross - bar) / 2,
            width: bar,
            height: cross,
            background: "#fdfbf4",
            borderRadius: bar / 2,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: (cross - bar) / 2,
            left: 0,
            width: cross,
            height: bar,
            background: "#fdfbf4",
            borderRadius: bar / 2,
          }}
        />
      </div>
    </div>,
    { width: size, height: size },
  );
}
