import { LogOut, MonitorSmartphone, Moon, Share, SquarePlus } from "lucide-react";
import { signOut } from "@/app/actions";
import { NotificationSettings } from "@/components/NotificationSettings";
import { PageHeader } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";

// Things rarely changed, kept off the main pages: account, reminders, installing the app, appearance.
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: member } = user
    ? await supabase.from("members").select("display_name").eq("user_id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-8">
      <PageHeader back={{ href: "/", label: "Trang chủ" }} title="Cài đặt" />

      <section>
        <h2 className="section-title">Tài khoản</h2>
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">{member?.display_name ?? "Thành viên"}</div>
            <div className="muted truncate">{user?.email}</div>
          </div>
          <form action={signOut}>
            <button className="btn">
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Đăng xuất
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="section-title">Nhắc lịch</h2>
        <NotificationSettings />
      </section>

      <section>
        <h2 className="section-title">Cài như ứng dụng</h2>
        <div className="card space-y-3 text-sm">
          <p className="flex items-start gap-2">
            <Share className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.75} />
            <span>
              <span className="font-medium">iPhone, iPad:</span> mở trang trong Safari, bấm Chia sẻ → Thêm vào Màn hình
              chính, rồi mở từ biểu tượng mới. Nhắc lịch chỉ hoạt động khi mở theo cách này.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <SquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.75} />
            <span>
              <span className="font-medium">Android, máy tính (Chrome, Edge):</span> bấm Cài đặt ứng dụng trên thanh
              địa chỉ hoặc trong menu trình duyệt.
            </span>
          </p>
        </div>
      </section>

      <section>
        <h2 className="section-title">Giao diện</h2>
        <div className="card flex items-start gap-2 text-sm">
          <Moon className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.75} />
          <span>
            Sáng hoặc tối tự đổi theo cài đặt của điện thoại hay máy tính (Chế độ tối). Khi in, trang luôn dùng nền
            trắng.
          </span>
        </div>
      </section>

      <p className="muted flex items-center gap-2">
        <MonitorSmartphone className="h-4 w-4" strokeWidth={1.75} />
        Sổ bệnh án · dữ liệu chỉ hai thành viên xem được
      </p>
    </div>
  );
}
