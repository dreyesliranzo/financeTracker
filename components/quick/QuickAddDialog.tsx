"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { BudgetForm } from "@/components/forms/BudgetForm";
import { GoalForm } from "@/components/forms/GoalForm";
import { RecurringForm } from "@/components/forms/RecurringForm";

type QuickAddTab = "transaction" | "budget" | "goal" | "recurring";

const storageKey = "ledgerly:last-quick-add-tab";

export function QuickAddDialog({
  open,
  onOpenChange,
  initialTab
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: QuickAddTab;
}) {
  const [tab, setTab] = useState<QuickAddTab>("transaction");

  const resolvedInitial = useMemo<QuickAddTab>(() => {
    if (initialTab) return initialTab;
    if (typeof window === "undefined") return "transaction";
    const stored = window.localStorage.getItem(storageKey) as QuickAddTab | null;
    return stored ?? "transaction";
  }, [initialTab]);

  useEffect(() => {
    setTab(resolvedInitial);
  }, [resolvedInitial, open]);

  const handleTabChange = (value: string) => {
    const next = value as QuickAddTab;
    setTab(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, next);
    }
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <Tabs value={tab} onValueChange={handleTabChange}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="transaction">Transaction</TabsTrigger>
              <TabsTrigger value="budget">Budget</TabsTrigger>
              <TabsTrigger value="goal">Goal</TabsTrigger>
              <TabsTrigger value="recurring">Recurring</TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">
              Press Esc to close • Remembers last tab
            </p>
          </div>
          <TabsContent value="transaction">
            <TransactionForm onSuccess={handleClose} />
          </TabsContent>
          <TabsContent value="budget">
            <BudgetForm onSuccess={handleClose} />
          </TabsContent>
          <TabsContent value="goal">
            <GoalForm onSuccess={handleClose} />
          </TabsContent>
          <TabsContent value="recurring">
            <RecurringForm onSuccess={handleClose} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
