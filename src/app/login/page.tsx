"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, null);
  return (
    <div className="mx-auto mt-16 max-w-sm">
      <h1 className="mb-6 text-center text-2xl font-bold text-teal-700">🩺 Sổ bệnh án</h1>
      <form action={action} className="card space-y-4">
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block">
          <span className="label">Mật khẩu</span>
          <input name="password" type="password" required autoComplete="current-password" className="input" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
