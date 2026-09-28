"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";

// A plain button that dims and disables itself while its parent form's action is running -
// for small icon/toggle buttons that aren't the form's main "submit" action visually.
export function PendingButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return <button {...props} disabled={pending} className={`${className} ${pending ? "opacity-40" : ""}`} />;
}
