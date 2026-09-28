import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { TopLoader } from "@/components/TopLoader";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sổ bệnh án",
  description: "Lưu trữ bệnh án gia đình",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isMember = false;
  if (user) {
    const { data } = await supabase.from("members").select("user_id").eq("user_id", user.id).maybeSingle();
    isMember = !!data;
  }

  return (
    <html lang="vi" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <TopLoader />
        {user && (
          <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
              <Link href="/" className="text-lg font-bold text-teal-700">
                🩺 Sổ bệnh án
              </Link>
              <form action={signOut}>
                <button className="text-sm text-slate-500 hover:text-slate-800">Đăng xuất</button>
              </form>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-4xl px-4 py-6">
          {user && !isMember ? (
            <div className="card">
              <p className="font-medium">Tài khoản {user.email} chưa được cấp quyền.</p>
              <p className="muted mt-1">Thêm tài khoản này vào bảng members (xem README).</p>
            </div>
          ) : (
            children
          )}
        </main>
      </body>
    </html>
  );
}
