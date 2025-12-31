import { Shell } from "@/components/layout/Shell";
import { PageEnter } from "@/components/layout/PageEnter";

import type { ReactNode } from "react";

export default function AppLayout({
  children
}: {
  children: ReactNode;
}) {
  return (
    <PageEnter>
      <Shell>{children}</Shell>
    </PageEnter>
  );
}
