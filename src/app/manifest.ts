import type { MetadataRoute } from "next";

// Makes the site installable ("Thêm vào Màn hình chính"): it then opens full-screen like an app,
// and on iPhone that is also what allows push notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sổ bệnh án",
    short_name: "Bệnh án",
    description: "Lưu trữ bệnh án gia đình",
    lang: "vi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f3e8",
    theme_color: "#fdfbf4",
    icons: [
      { src: "/app-icons/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icons/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
