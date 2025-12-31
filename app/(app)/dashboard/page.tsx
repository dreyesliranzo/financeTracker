"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchBudgets,
  fetchCategories,
  fetchAccounts,
  fetchGoals,
  fetchOverallBudgets,
  fetchProfile,
  fetchSubscriptionCandidates,
  fetchTransactionsSummary,
  fetchRecurringTransactions
} from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { ExpenseByCategoryChart } from "@/components/charts/ExpenseByCategoryChart";
import { CashflowChart } from "@/components/charts/CashflowChart";
import { BudgetProgressList } from "@/components/charts/BudgetProgressList";
import { GoalProgressList } from "@/components/charts/GoalProgressList";
import { OnboardingChecklist } from "@/components/empty/OnboardingChecklist";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { Stagger } from "@/components/layout/Stagger";
import { sumIncomeExpense, categoryTotals, flattenSplits, type TransactionWithSplits } from "@/lib/utils/transactions";
import { estimateMonthlyCents } from "@/lib/utils/subscriptions";

export default function DashboardPage() {
  const router = useRouter();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const didSelectCurrency = useRef(false);
  const [year, monthIndex] = month.split("-").map((value) => Number(value));
  const monthDate = new Date(year, monthIndex - 1, 1);
  const rangeStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", rangeStart, rangeEnd, selectedCurrency],
    queryFn: () =>
      fetchTransactionsSummary({ start: rangeStart, end: rangeEnd }, selectedCurrency)
  });
  const transactions = transactionsQuery.data ?? [];

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

  const goalsQuery = useQuery({
    queryKey: ["goals", selectedCurrency],
    queryFn: () => fetchGoals(selectedCurrency)
  });
  const goals = goalsQuery.data ?? [];

  const recurringQuery = useQuery({
    queryKey: ["recurring_transactions"],
    queryFn: fetchRecurringTransactions
  });
  const recurring = recurringQuery.data ?? [];

  const subscriptionsQuery = useQuery({
    queryKey: ["subscription_candidates"],
    queryFn: fetchSubscriptionCandidates
  });
  const subscriptions = subscriptionsQuery.data ?? [];

  const isLoading =
    transactionsQuery.isLoading ||
    budgetsQuery.isLoading ||
    categoriesQuery.isLoading ||
    accountsQuery.isLoading ||
    overallBudgetsQuery.isLoading ||
    goalsQuery.isLoading ||
    recurringQuery.isLoading ||
    subscriptionsQuery.isLoading;

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

  const scopedTransactions = useMemo<TransactionWithSplits[]>(() => {
    return transactions.filter(
      (transaction) => transaction.currency_code === selectedCurrency
    ) as TransactionWithSplits[];
  }, [selectedCurrency, transactions]);

  const { income, expense, net } = useMemo(() => {
    return sumIncomeExpense(scopedTransactions);
  }, [scopedTransactions]);

  const remainingBudget = useMemo(() => {
    if (overallBudget) {
      return overallBudget.limit_cents - expense;
    }
    const totalLimit = budgets.reduce((sum, budget) => sum + budget.limit_cents, 0);
    return totalLimit - expense;
  }, [overallBudget, budgets, expense]);

  const expenseByCategory = useMemo(() => {
    const totals = categoryTotals(scopedTransactions);
    return Object.entries(totals)
      .map(([categoryId, value]) => ({
        name: categoryNameMap.get(categoryId) ?? "Uncategorized",
        value: Math.round(value / 100)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [categoryNameMap, scopedTransactions]);

  const cashflowData = useMemo(() => {
    const byDate = new Map<string, { income: number; expense: number }>();
    scopedTransactions
      .filter((transaction) => (transaction.transaction_kind ?? transaction.type) !== "transfer")
      .forEach((transaction) => {
        if (!byDate.has(transaction.date)) {
          byDate.set(transaction.date, { income: 0, expense: 0 });
        }
        const entry = byDate.get(transaction.date)!;
        const kind = transaction.transaction_kind ?? transaction.type;
        if (kind === "income") {
          entry.income += transaction.amount_cents / 100;
        } else {
          entry.expense += transaction.amount_cents / 100;
        }
      });

    return Array.from(byDate.entries())
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [scopedTransactions]);

  const budgetProgress = useMemo(() => {
    return budgets.map((budget) => {
      const spent = scopedTransactions.reduce((sum, transaction) => {
        flattenSplits(transaction).forEach((line) => {
          if (line.kind !== "expense") return;
          if (line.category_id === budget.category_id) {
            sum += line.amount_cents;
          }
        });
        return sum;
      }, 0);

      return {
        category: categoryNameMap.get(budget.category_id) ?? "Uncategorized",
        spent,
        limit: budget.limit_cents
      };
    });
  }, [budgets, scopedTransactions, categoryNameMap]);

  const goalProgress = useMemo(() => {
    return goals
      .map((goal) => ({
        name: goal.name,
        current: goal.current_cents,
        target: goal.target_cents
      }))
      .sort((a, b) => b.target - a.target)
      .slice(0, 4);
  }, [goals]);

  const notifications = useMemo(() => {
    const items: Array<{ title: string; detail: string }> = [];

    budgetProgress.forEach((item) => {
      if (!item.limit) return;
      const ratio = item.spent / item.limit;
      if (ratio >= 0.8) {
        items.push({
          title: `Budget alert: ${item.category}`,
          detail: `${Math.round(ratio * 100)}% used`
        });
      }
    });

    goals.forEach((goal) => {
      if (!goal.target_cents) return;
      const ratio = goal.current_cents / goal.target_cents;
      if (ratio >= 0.8 && ratio < 1) {
        items.push({
          title: `Goal nearing: ${goal.name}`,
          detail: `${Math.round(ratio * 100)}% complete`
        });
      }
    });

    const upcoming = recurring.filter((item) => item.active && item.next_run);
    const today = new Date();
    upcoming.forEach((item) => {
      const runDate = new Date(item.next_run);
      const diff = runDate.getTime() - today.getTime();
      if (diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000) {
        items.push({
          title: "Upcoming recurring",
          detail: `${item.name || item.merchant || "Recurring"} due ${item.next_run}`
        });
      }
    });

    return items.slice(0, 4);
  }, [budgetProgress, goals, recurring]);

  const subscriptionSummary = useMemo(() => {
    const ranked = subscriptions
      .map((candidate) => ({
        ...candidate,
        monthly_cents: estimateMonthlyCents(candidate)
      }))
      .sort((a, b) => b.monthly_cents - a.monthly_cents);
    return {
      total: ranked.reduce((sum, item) => sum + item.monthly_cents, 0),
      top: ranked.slice(0, 5)
    };
  }, [subscriptions]);

  const onboardingItems = useMemo(() => {
    return [
      {
        label: "Add your first account",
        done: accounts.length > 0,
        action: accounts.length === 0 ? (
          <Button variant="secondary" size="sm" onClick={() => router.push("/settings")}>
            Go
          </Button>
        ) : undefined
      },
      {
        label: "Create categories",
        done: categories.length > 0,
        action: categories.length === 0 ? (
          <Button variant="secondary" size="sm" onClick={() => router.push("/settings")}>
            Go
          </Button>
        ) : undefined
      },
      {
        label: "Add a transaction",
        done: transactions.length > 0,
        action: transactions.length === 0 ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">Add</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <TransactionForm />
            </DialogContent>
          </Dialog>
        ) : undefined
      },
      {
        label: "Set a budget",
        done: budgets.length > 0,
        action: budgets.length === 0 ? (
          <Button variant="secondary" size="sm" onClick={() => router.push("/budgets")}>
            Go
          </Button>
        ) : undefined
      },
      {
        label: "Create a goal",
        done: goals.length > 0,
        action: goals.length === 0 ? (
          <Button variant="secondary" size="sm" onClick={() => router.push("/goals")}>
            Go
          </Button>
        ) : undefined
      }
    ];
  }, [accounts.length, budgets.length, categories.length, goals.length, transactions.length]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Financial overview</h1>
          <p className="text-sm text-muted-foreground">
            Track your month at a glance.
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
        </div>
      </div>

      <OnboardingChecklist
        title="Getting started"
        description="Complete these steps to personalize your workspace."
        items={onboardingItems}
      />

      <Stagger step={60} className="space-y-8">
        {notifications.length > 0 ? (
          <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <p className="text-sm font-medium text-foreground">Notifications</p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {notifications.map((item) => (
                <div
                  key={`${item.title}-${item.detail}`}
                  className="rounded-xl border border-border/60 px-3 py-2 text-sm"
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Net</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-semibold">
                  {formatCurrency(net, selectedCurrency)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Income</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-semibold text-emerald-400">
                  {formatCurrency(income, selectedCurrency)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Expenses</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div className="text-2xl font-semibold text-rose-400">
                  {formatCurrency(expense, selectedCurrency)}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                Remaining budget
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <div>
                  <div className="text-2xl font-semibold">
                    {formatCurrency(remainingBudget, selectedCurrency)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {overallBudget ? "General budget" : "Category budgets"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
            <CardHeader>
              <CardTitle>Expenses by category</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <ExpenseByCategoryChart data={expenseByCategory} />
              )}
            </CardContent>
          </Card>
          <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
            <CardHeader>
              <CardTitle>Cashflow</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : (
                <CashflowChart data={cashflowData} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
            <CardHeader>
              <CardTitle>Budget progress</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : budgetProgress.length > 0 ? (
                <BudgetProgressList items={budgetProgress} currencyCode={selectedCurrency} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Set a budget to track your progress.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
            <CardHeader>
              <CardTitle>Goals progress</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : goalProgress.length > 0 ? (
                <GoalProgressList items={goalProgress} currencyCode={selectedCurrency} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Create goals to track progress here.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10">
            <CardHeader>
              <CardTitle>Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              ) : subscriptions.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-semibold">
                      {formatCurrency(subscriptionSummary.total, selectedCurrency)}
                    </div>
                    <p className="text-xs text-muted-foreground">Estimated per month</p>
                  </div>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {subscriptionSummary.top.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span className="truncate text-foreground">{item.merchant}</span>
                        <span className="text-xs">
                          {formatCurrency(item.monthly_cents, selectedCurrency)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/subscriptions")}
                    className="px-0 text-sm"
                  >
                    View subscription hub
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No subscriptions detected yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </Stagger>
    </div>
  );
}
