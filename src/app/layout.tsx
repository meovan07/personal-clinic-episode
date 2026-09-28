import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { LogOut, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";
import { PersonNav } from "@/components/PersonNav";
import { QuickAddButton } from "@/components/QuickAddButton";
import { TopLoader } from "@/components/TopLoader";
import "./globals.css";

// The "+" button's AI processing runs inside a server action and can take up to a minute.
export const maxDuration = 300;

const sans = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});
const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
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
  let people: { id: string; full_name: string }[] = [];
  if (user) {
    const { data } = await supabase.from("members").select("user_id").eq("user_id", user.id).maybeSingle();
    isMember = !!data;
    if (isMember) {
      const { data: peopleData } = await supabase.from("people").select("id, full_name").order("created_at");
      people = peopleData ?? [];
    }
  }

  return (
    <html lang="vi" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <TopLoader />
        {user && (
          <header className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-pine hover:text-pine-dark">
                <Stethoscope className="h-5 w-5" strokeWidth={2} />
                <span className="hidden sm:inline">Sổ bệnh án</span>
              </Link>
              {isMember && <PersonNav people={people} />}
              <form action={signOut} className="shrink-0">
                <button className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink" aria-label="Đăng xuất">
                  <LogOut className="h-4 w-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Đăng xuất</span>
                </button>
              </form>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-4xl px-4 py-6 pb-24 sm:pb-6">
          {user && !isMember ? (
            <div className="card">
              <p className="font-medium">Tài khoản {user.email} chưa được cấp quyền.</p>
              <p className="muted mt-1">Thêm tài khoản này vào bảng members (xem README).</p>
            </div>
          ) : (
            children
          )}
        </main>
        {user && isMember && <QuickAddButton />}
      </body>
    </html>
  );
}
