"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Settings,
  Target,
  Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/budgets", label: "Budgets", icon: Wallet },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings }
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 flex-col border-r border-border/60 bg-card/40 px-4 py-6 backdrop-blur lg:flex">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/20 text-primary">
          <span className="text-lg font-semibold">L</span>
        </div>
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
            Ledgerly
          </p>
          <p className="text-xs text-muted-foreground">Realtime finance</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href as Route}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Sync status</p>
        <p className="mt-1">Realtime updates enabled.</p>
      </div>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Copyright Diego Reyes
      </p>
    </aside>
  );
}
