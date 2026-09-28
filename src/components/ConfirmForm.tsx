"use client";

import type { ReactNode } from "react";

// A form that asks for confirmation before running its server action.
export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: () => Promise<void>;
  message: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
