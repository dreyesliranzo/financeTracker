"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchAccounts,
  fetchBudgets,
  fetchCategories,
  fetchOverallBudgets,
  fetchProfile,
  fetchTransactionsSummary
} from "@/lib/supabase/queries";
import { deleteBudget, deleteOverallBudget } from "@/lib/supabase/mutations";
import { BudgetForm } from "@/components/forms/BudgetForm";
import { OverallBudgetForm } from "@/components/forms/OverallBudgetForm";
import { formatCurrency } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { Stagger } from "@/components/layout/Stagger";

export default function BudgetsPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const didSelectCurrency = useRef(false);
  const [accountFilter, setAccountFilter] = useState("all");
  const queryClient = useQueryClient();
  const [year, monthIndex] = month.split("-").map((value) => Number(value));
  const monthDate = new Date(year, monthIndex - 1, 1);
  const rangeStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
  const prevMonthDate = subMonths(monthDate, 1);
  const prevMonth = format(prevMonthDate, "yyyy-MM");
  const prevRangeStart = format(startOfMonth(prevMonthDate), "yyyy-MM-dd");
  const prevRangeEnd = format(endOfMonth(prevMonthDate), "yyyy-MM-dd");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });

  const budgetsQuery = useQuery({
    queryKey: ["budgets", month, selectedCurrency],
    queryFn: () => fetchBudgets(`${month}-01`, selectedCurrency)
  });
  const budgets = budgetsQuery.data ?? [];

  const overallBudgetsQuery = useQuery({
    queryKey: ["overall_budgets", month, selectedCurrency],
    queryFn: () => fetchOverallBudgets(`${month}-01`, selectedCurrency)
  });
  const overallBudget = overallBudgetsQuery.data?.[0] ?? null;

  const previousBudgetsQuery = useQuery({
    queryKey: ["budgets", prevMonth, selectedCurrency, "previous"],
    queryFn: () => fetchBudgets(`${prevMonth}-01`, selectedCurrency)
  });
  const previousBudgets = previousBudgetsQuery.data ?? [];

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });
  const categories = categoriesQuery.data ?? [];

  const accountsQuery = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts
  });
  const accounts = accountsQuery.data ?? [];

  const transactionsQuery = useQuery({
    queryKey: ["transactions", rangeStart, rangeEnd, selectedCurrency],
    queryFn: () =>
      fetchTransactionsSummary({ start: rangeStart, end: rangeEnd }, selectedCurrency)
  });
  const transactions = transactionsQuery.data ?? [];

  const prevTransactionsQuery = useQuery({
    queryKey: ["transactions", prevRangeStart, prevRangeEnd, selectedCurrency, "previous"],
    queryFn: () =>
      fetchTransactionsSummary({ start: prevRangeStart, end: prevRangeEnd }, selectedCurrency)
  });
  const prevTransactions = prevTransactionsQuery.data ?? [];

  const isLoading =
    budgetsQuery.isLoading ||
    overallBudgetsQuery.isLoading ||
    categoriesQuery.isLoading ||
    transactionsQuery.isLoading ||
    previousBudgetsQuery.isLoading ||
    prevTransactionsQuery.isLoading ||
    accountsQuery.isLoading;

  useEffect(() => {
    if (!profile?.default_currency) return;
    if (didSelectCurrency.current) return;
    setSelectedCurrency(profile.default_currency);
  }, [profile?.default_currency]);

  const categoryNameMap = useMemo(() => {
    return new Map(
      categories
        .filter((category) => Boolean(category.id))
        .map((category) => [category.id!, category.name])
    );
  }, [categories]);

  const budgetsWithProgress = useMemo(() => {
    const prevSpentByCategory = new Map<string, number>();
    prevTransactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          (accountFilter === "all" || transaction.account_id === accountFilter)
      )
      .forEach((transaction) => {
        const key = transaction.category_id ?? "uncategorized";
        prevSpentByCategory.set(
          key,
          (prevSpentByCategory.get(key) ?? 0) + transaction.amount_cents
        );
      });

    const prevBudgetByCategory = new Map(
      previousBudgets.map((budget) => [budget.category_id, budget.limit_cents])
    );

    return budgets.map((budget) => {
      const spent = transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.category_id === budget.category_id &&
            (accountFilter === "all" || transaction.account_id === accountFilter)
        )
        .reduce((sum, transaction) => sum + transaction.amount_cents, 0);

      const prevLimit = prevBudgetByCategory.get(budget.category_id) ?? 0;
      const prevSpent = prevSpentByCategory.get(budget.category_id) ?? 0;
      const carryover = Math.max(0, prevLimit - prevSpent);

      return {
        ...budget,
        categoryName: categoryNameMap.get(budget.category_id) ?? "Uncategorized",
        spent,
        carryover,
        effectiveLimit: budget.limit_cents + carryover
      };
    });
  }, [
    accountFilter,
    budgets,
    categoryNameMap,
    prevTransactions,
    previousBudgets,
    transactions
  ]);

  const overallSpent = useMemo(() => {
    return transactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          (accountFilter === "all" || transaction.account_id === accountFilter)
      )
      .reduce((sum, transaction) => sum + transaction.amount_cents, 0);
  }, [accountFilter, transactions]);

  const overallRatio =
    overallBudget && overallBudget.limit_cents
      ? overallSpent / overallBudget.limit_cents
      : 0;

  const alertBudgets = useMemo(() => {
    return budgetsWithProgress.filter((budget) => {
      const ratio = budget.effectiveLimit
        ? budget.spent / budget.effectiveLimit
        : 0;
      return ratio >= 0.8;
    });
  }, [budgetsWithProgress]);

  const handleDelete = async (id: string) => {
    try {
      await deleteBudget(id);
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      toast.success("Budget deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete budget");
    }
  };

  const handleDeleteOverall = async (id: string) => {
    try {
      await deleteOverallBudget(id);
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      toast.success("General budget deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete general budget");
    }
  };

  return (
    <Stagger step={60} className="space-y-6">
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
          <Select
            value={selectedCurrency}
            onValueChange={(value) => {
              didSelectCurrency.current = true;
              setSelectedCurrency(value);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {currencyOptions.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id!} value={account.id!}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>General budget</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track total spending across categories.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  {overallBudget ? "Edit" : "Set budget"}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <OverallBudgetForm budget={overallBudget} />
              </DialogContent>
            </Dialog>
            {overallBudget ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete general budget?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteOverall(overallBudget.id!)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {overallBudget ? (
            <>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(overallSpent, selectedCurrency)} of{" "}
                {formatCurrency(overallBudget.limit_cents, selectedCurrency)}
              </p>
              <div className="mt-3 h-2 w-full rounded-full bg-muted/40">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{
                    width: `${Math.min(overallRatio * 100, 100)}%`
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {overallBudget.limit_cents - overallSpent >= 0
                  ? `${Math.round(overallRatio * 100)}% used`
                  : "Over budget"}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Set a general budget to track total monthly spend.
            </p>
          )}
        </CardContent>
      </Card>

      {alertBudgets.length > 0 ? (
        <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Budget alerts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {alertBudgets.map((budget) => {
              const ratio = budget.effectiveLimit
                ? budget.spent / budget.effectiveLimit
                : 0;
              return (
                <div
                  key={`alert-${budget.id}`}
                  className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{budget.categoryName}</p>
                    <p className="text-xs text-muted-foreground">
                      {ratio >= 1 ? "Over budget" : "Near limit"}
                    </p>
                  </div>
                  <p className="font-medium">
                    {formatCurrency(budget.spent, selectedCurrency)} /{" "}
                    {formatCurrency(budget.effectiveLimit, selectedCurrency)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={`budget-skeleton-${index}`} className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
                <CardHeader className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-44" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-3 w-20" />
                </CardContent>
              </Card>
            ))
          : budgetsWithProgress.map((budget) => {
              const ratio = budget.effectiveLimit
                ? budget.spent / budget.effectiveLimit
                : 0;
              return (
                <Card
                  key={budget.id}
                  className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10"
                >
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle>{budget.categoryName}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(budget.spent, selectedCurrency)} of {formatCurrency(budget.effectiveLimit, selectedCurrency)}
                      </p>
                      {budget.carryover > 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Includes {formatCurrency(budget.carryover, selectedCurrency)} rollover
                        </p>
                      ) : null}
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
    </Stagger>
  );
}
