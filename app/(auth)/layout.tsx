import { AuthShell } from "@/components/layout/AuthShell";

import type { ReactNode } from "react";

export default function AuthLayout({
  children
}: {
  children: ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
