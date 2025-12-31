"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { DialogTrigger } from "@/components/ui/dialog";

type CommandItem = {
  label: string;
  description?: string;
  action: () => void;
};

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Transactions", href: "/transactions" },
  { label: "Budgets", href: "/budgets" },
  { label: "Goals", href: "/goals" },
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
    return actions;
  }, [router]);

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
                  <span>{item.label}</span>
                  {item.description ? (
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  ) : null}
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

      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <TransactionForm onSuccess={() => setQuickAddOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
