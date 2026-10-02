import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono, Newsreader } from "next/font/google";
import Link from "next/link";
import { Settings, Stethoscope } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/AppShell";
import { AssistantChat } from "@/components/AssistantChat";
import { PersonNav, PersonTabBar } from "@/components/PersonNav";
import { QuickAddButton } from "@/components/QuickAddButton";
import { SearchDialog } from "@/components/SearchDialog";
import { TopLoader } from "@/components/TopLoader";
import "./globals.css";

// The "+" button's AI processing runs inside a server action and can take up to a minute.
export const maxDuration = 300;

const sans = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});
// Page and section titles (editorial serif with Vietnamese support; see docs/design.md).
const serif = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
});
const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Sổ bệnh án",
  description: "Lưu trữ bệnh án gia đình",
  // Installed on an iPhone home screen: open full-screen, with this name under the icon.
  appleWebApp: { capable: true, title: "Bệnh án", statusBarStyle: "default" },
  // Next emits the standard mobile-web-app-capable; older iOS versions only read the apple- prefixed one.
  other: { "apple-mobile-web-app-capable": "yes" },
};

// maximumScale 1 stops iOS auto-zooming the page when a <16px input/select is focused -
// accepted tradeoff since pinch-zoom is rarely needed on this app's short forms/lists.
// viewportFit "cover" is required for env(safe-area-inset-*) to resolve to anything but 0 -
// without it, the header/bottom-nav safe-area padding below has no effect at all.
// themeColor tints the browser bar / status bar to match the header.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e141b" },
  ],
};

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
    <html lang="vi" className={`${sans.variable} ${serif.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <AppShell />
        <div className="print:hidden">
          <TopLoader />
        </div>
        {user && (
          <header className="sticky top-0 z-10 border-b print:hidden border-line bg-paper/90 pt-[env(safe-area-inset-top)] backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
              <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-pine hover:text-pine-dark">
                <Stethoscope className="h-5 w-5" strokeWidth={2} />
                <span className="hidden sm:inline">Sổ bệnh án</span>
              </Link>
              {isMember && <PersonNav people={people} />}
              <div className="flex shrink-0 items-center gap-4">
                {isMember && <SearchDialog />}
                <Link
                  href="/settings"
                  className="flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink"
                  aria-label="Cài đặt"
                >
                  <Settings className="h-4 w-4" strokeWidth={1.75} />
                  <span className="hidden sm:inline">Cài đặt</span>
                </Link>
              </div>
            </div>
          </header>
        )}
        <main className="mx-auto max-w-5xl px-4 py-6 pb-24 sm:pb-6 print:max-w-none print:p-0">
          {user && !isMember ? (
            <div className="card">
              <p className="font-medium">Tài khoản {user.email} chưa được cấp quyền.</p>
              <p className="muted mt-1">Thêm tài khoản này vào bảng members (xem README).</p>
            </div>
          ) : (
            children
          )}
        </main>
        {user && isMember && (
          <div className="print:hidden">
            <PersonTabBar people={people} />
            <QuickAddButton />
            <AssistantChat />
          </div>
        )}
      </body>
    </html>
  );
}
