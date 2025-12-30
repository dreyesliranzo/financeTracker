"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { fetchBudgets, fetchCategories, fetchTransactions } from "@/lib/supabase/queries";
import { deleteBudget } from "@/lib/supabase/mutations";
import { BudgetForm } from "@/components/forms/BudgetForm";
import { formatCurrency } from "@/lib/money";

export default function BudgetsPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const queryClient = useQueryClient();
  const rangeStart = format(startOfMonth(new Date(`${month}-01`)), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(new Date(`${month}-01`)), "yyyy-MM-dd");

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", month],
    queryFn: () => fetchBudgets(`${month}-01`)
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", rangeStart, rangeEnd],
    queryFn: () => fetchTransactions({ start: rangeStart, end: rangeEnd })
  });

  const budgetsWithProgress = useMemo(() => {
    return budgets.map((budget) => {
      const spent = transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.category_id === budget.category_id
        )
        .reduce((sum, transaction) => sum + transaction.amount_cents, 0);

      return {
        ...budget,
        categoryName:
          categories.find((category) => category.id === budget.category_id)?.name ??
          "Uncategorized",
        spent
      };
    });
  }, [budgets, transactions, categories]);

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget(id);
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("Budget deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete budget");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Budgets</h1>
          <p className="text-sm text-muted-foreground">
            Set monthly limits and monitor burn-down.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="w-[170px]"
          />
          <Dialog>
            <DialogTrigger asChild>
              <Button>Create budget</Button>
            </DialogTrigger>
            <DialogContent>
              <BudgetForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {budgetsWithProgress.map((budget) => {
          const ratio = budget.limit_cents
            ? budget.spent / budget.limit_cents
            : 0;
          return (
            <Card key={budget.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>{budget.categoryName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {formatCurrency(budget.spent)} of {formatCurrency(budget.limit_cents)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <BudgetForm budget={budget} />
                    </DialogContent>
                  </Dialog>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete budget?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(budget.id!)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-2 w-full rounded-full bg-muted/40">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {ratio >= 1 ? "Over budget" : `${Math.round(ratio * 100)}% used`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
