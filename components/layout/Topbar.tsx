"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SyncStatus } from "@/components/layout/SyncStatus";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { signOut } from "@/lib/supabase/auth";
import { useAuth } from "@/components/providers/AuthProvider";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/recurring", label: "Recurring" },
  { href: "/budgets", label: "Budgets" },
  { href: "/goals", label: "Goals" },
  { href: "/insights", label: "Insights" },
  { href: "/projections", label: "Projections" },
  { href: "/advisor", label: "Advisor" },
  { href: "/settings", label: "Settings" }
] as const;

const titleMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/transactions": "Transactions",
  "/recurring": "Recurring",
  "/budgets": "Budgets",
  "/goals": "Goals",
  "/insights": "Insights",
  "/projections": "Projections",
  "/advisor": "Advisor",
  "/settings": "Settings"
};

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const basePath = `/${pathname.split("/")[1] || "dashboard"}`;
  const title = titleMap[basePath] ?? "Dashboard";
  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/95 px-4 py-4 lg:px-10">
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <nav className="mt-6 flex flex-col gap-2">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href as Route}
                    className={cn(
                      "rounded-xl px-3 py-2 text-sm",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {title}
          </p>
          <p className="text-lg font-semibold">{title}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SyncStatus />
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => window.dispatchEvent(new Event("app:global-search"))}
          aria-label="Open search"
        >
          <Search className="h-4 w-4" />
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Quick add
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <TransactionForm onSuccess={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <span className="text-xs font-semibold">
                {user?.email?.slice(0, 2).toUpperCase() ?? "U"}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {user?.email ?? "Signed in"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
