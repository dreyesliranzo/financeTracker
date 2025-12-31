"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { QuickAddDialog } from "@/components/quick/QuickAddDialog";
import { fetchCategories, fetchTransactionsSummary } from "@/lib/supabase/queries";

type CommandItem = {
  label: string;
  description?: string;
  action: () => void;
  badge?: string;
};

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Transactions", href: "/transactions" },
  { label: "Budgets", href: "/budgets" },
  { label: "Goals", href: "/goals" },
  { label: "Subscriptions", href: "/subscriptions" },
  { label: "Insights", href: "/insights" },
  { label: "Projections", href: "/projections" },
  { label: "Advisor", href: "/advisor" },
  { label: "Settings", href: "/settings" }
] as const;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddTab, setQuickAddTab] = useState<"transaction" | "budget" | "goal" | "recurring">("transaction");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", "summary", "palette"],
    queryFn: () => fetchTransactionsSummary(undefined, undefined),
    staleTime: 60_000
  });

  const merchants = useMemo(
    () =>
      Array.from(
        new Set(
          (transactions ?? [])
            .map((txn) => txn.merchant?.trim())
            .filter(Boolean)
        )
      ).slice(0, 30),
    [transactions]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isCmdK) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const commands = useMemo<CommandItem[]>(() => {
    const actions: CommandItem[] = [
      {
        label: "Add transaction",
        description: "Quick add a new transaction",
        action: () => {
          setQuickAddTab("transaction");
          setQuickAddOpen(true);
          setOpen(false);
        }
      },
      {
        label: "Add budget",
        description: "Create a category budget",
        action: () => {
          setQuickAddTab("budget");
          setQuickAddOpen(true);
          setOpen(false);
        }
      },
      {
        label: "Add goal",
        description: "Create a savings goal",
        action: () => {
          setQuickAddTab("goal");
          setQuickAddOpen(true);
          setOpen(false);
        }
      },
      {
        label: "Add recurring",
        description: "Create a recurring item",
        action: () => {
          setQuickAddTab("recurring");
          setQuickAddOpen(true);
          setOpen(false);
        }
      },
      {
        label: "Global search",
        description: "Search transactions and entities",
        action: () => {
          window.dispatchEvent(new Event("app:global-search"));
          setOpen(false);
        }
      }
    ];

    navItems.forEach((item) => {
      actions.push({
        label: item.label,
        description: `Go to ${item.label}`,
        action: () => {
          router.push(item.href);
          setOpen(false);
        }
      });
    });
    categories.forEach((category) =>
      actions.push({
        label: `Category: ${category.name}`,
        description: category.type,
        badge: "Category",
        action: () => {
          router.push("/transactions");
          setOpen(false);
          window.dispatchEvent(
            new CustomEvent("app:transactions:filter", {
              detail: { categoryId: category.id }
            })
          );
        }
      })
    );

    merchants.forEach((merchant) =>
      actions.push({
        label: `Merchant: ${merchant}`,
        description: "Search merchant",
        badge: "Merchant",
        action: () => {
          router.push("/transactions");
          setOpen(false);
          window.dispatchEvent(
            new CustomEvent("app:transactions:filter", {
              detail: { search: merchant }
            })
          );
        }
      })
    );

    return actions;
  }, [categories, merchants, router]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return commands;
    return commands.filter((item) =>
      [item.label, item.description].some((value) =>
        value?.toLowerCase().includes(term)
      )
    );
  }, [commands, query]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <div className="space-y-3">
            <Input
              placeholder="Type a command or search..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
            <div className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
              {filtered.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="flex w-full items-start justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted/40"
                >
                  <div className="flex flex-col text-left">
                    <span className="flex items-center gap-2">
                      {item.badge ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {item.badge}
                        </span>
                      ) : null}
                      <span>{item.label}</span>
                    </span>
                    {item.description ? (
                      <span className="text-xs text-muted-foreground">{item.description}</span>
                    ) : null}
                  </div>
                </button>
              ))}
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No matching commands.
                </p>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        initialTab={quickAddTab}
      />
    </>
  );
}
