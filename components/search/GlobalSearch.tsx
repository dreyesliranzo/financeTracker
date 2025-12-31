"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { fetchAccounts, fetchCategories, fetchTransactionsPage } from "@/lib/supabase/queries";
import { formatSignedCurrency } from "@/lib/money";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());

  useEffect(() => {
    const openHandler = () => setOpen(true);
    const keyHandler = (event: KeyboardEvent) => {
      const isSlash = event.key === "/";
      if (!isSlash) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("app:global-search", openHandler);
    window.addEventListener("keydown", keyHandler);
    return () => {
      window.removeEventListener("app:global-search", openHandler);
      window.removeEventListener("keydown", keyHandler);
    };
  }, []);

  const { data: transactionsResult } = useQuery({
    queryKey: ["transactions", "global-search", deferredQuery],
    queryFn: () =>
      fetchTransactionsPage({
        filters: { search: deferredQuery },
        page: 1,
        pageSize: 8,
        sortKey: "date"
      }),
    enabled: deferredQuery.length > 1
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts
  });

  const filteredCategories = useMemo(() => {
    if (!deferredQuery) return [];
    const term = deferredQuery.toLowerCase();
    return categories.filter((category) => category.name.toLowerCase().includes(term));
  }, [categories, deferredQuery]);

  const filteredAccounts = useMemo(() => {
    if (!deferredQuery) return [];
    const term = deferredQuery.toLowerCase();
    return accounts.filter((account) => account.name.toLowerCase().includes(term));
  }, [accounts, deferredQuery]);

  const transactions = transactionsResult?.data ?? [];

  const handleNavigate = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <div className="space-y-4">
          <Input
            placeholder="Search transactions, categories, accounts..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />

          {deferredQuery.length <= 1 ? (
            <p className="text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Transactions</p>
                <div className="mt-2 space-y-2">
                  {transactions.map((transaction) => (
                    <button
                      key={transaction.id}
                      type="button"
                      onClick={() => handleNavigate("/transactions")}
                      className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm transition hover:bg-muted/40"
                    >
                      <span className="truncate">{transaction.merchant ?? transaction.date}</span>
                      <span className="font-medium">
                        {formatSignedCurrency(
                          transaction.amount_cents,
                          transaction.type,
                          transaction.currency_code ?? "USD"
                        )}
                      </span>
                    </button>
                  ))}
                  {transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No matching transactions.</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Categories</p>
                  <div className="mt-2 space-y-2">
                    {filteredCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleNavigate("/settings")}
                        className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm transition hover:bg-muted/40"
                      >
                        <span>{category.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {category.type}
                        </span>
                      </button>
                    ))}
                    {filteredCategories.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No matching categories.</p>
                    ) : null}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Accounts</p>
                  <div className="mt-2 space-y-2">
                    {filteredAccounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleNavigate("/settings")}
                        className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm transition hover:bg-muted/40"
                      >
                        <span>{account.name}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {account.type}
                        </span>
                      </button>
                    ))}
                    {filteredAccounts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No matching accounts.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
