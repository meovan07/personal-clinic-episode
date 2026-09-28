"use client";

import { useActionState } from "react";
import { Stethoscope } from "lucide-react";
import { signIn } from "@/app/actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, null);
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="mb-6 flex flex-col items-center gap-2 text-pine">
        <Stethoscope className="h-8 w-8" strokeWidth={1.75} />
        <h1 className="text-2xl font-bold text-ink">Sổ bệnh án</h1>
      </div>
      <form action={action} className="card space-y-4">
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block">
          <span className="label">Mật khẩu</span>
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </label>
        {error && <p className="text-sm text-stamp">{error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
