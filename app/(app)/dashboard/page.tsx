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
  fetchGoals,
  fetchOverallBudgets,
  fetchProfile,
  fetchTransactionsSummary
} from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { ExpenseByCategoryChart } from "@/components/charts/ExpenseByCategoryChart";
import { CashflowChart } from "@/components/charts/CashflowChart";
import { BudgetProgressList } from "@/components/charts/BudgetProgressList";
import { GoalProgressList } from "@/components/charts/GoalProgressList";

export default function DashboardPage() {
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

  const isLoading =
    transactionsQuery.isLoading ||
    budgetsQuery.isLoading ||
    categoriesQuery.isLoading ||
    overallBudgetsQuery.isLoading ||
    goalsQuery.isLoading;

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

  const scopedTransactions = useMemo(() => {
    return transactions.filter(
      (transaction) => transaction.currency_code === selectedCurrency
    );
  }, [selectedCurrency, transactions]);

  const { income, expense, net } = useMemo(() => {
    return scopedTransactions.reduce(
      (acc, transaction) => {
        if (transaction.type === "income") {
          acc.income += transaction.amount_cents;
        } else {
          acc.expense += transaction.amount_cents;
        }
        acc.net = acc.income - acc.expense;
        return acc;
      },
      { income: 0, expense: 0, net: 0 }
    );
  }, [scopedTransactions]);

  const remainingBudget = useMemo(() => {
    if (overallBudget) {
      return overallBudget.limit_cents - expense;
    }
    const totalLimit = budgets.reduce((sum, budget) => sum + budget.limit_cents, 0);
    return totalLimit - expense;
  }, [overallBudget, budgets, expense]);

  const expenseByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    scopedTransactions
      .filter((transaction) => transaction.type === "expense")
      .forEach((transaction) => {
        const key = transaction.category_id ?? "uncategorized";
        totals.set(key, (totals.get(key) ?? 0) + transaction.amount_cents);
      });

    return Array.from(totals.entries())
      .map(([categoryId, value]) => ({
        name: categoryNameMap.get(categoryId) ?? "Uncategorized",
        value: Math.round(value / 100)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [categoryNameMap, scopedTransactions]);

  const cashflowData = useMemo(() => {
    const byDate = new Map<string, { income: number; expense: number }>();
    scopedTransactions.forEach((transaction) => {
      if (!byDate.has(transaction.date)) {
        byDate.set(transaction.date, { income: 0, expense: 0 });
      }
      const entry = byDate.get(transaction.date)!;
      if (transaction.type === "income") {
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
      const spent = scopedTransactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.category_id === budget.category_id
        )
        .reduce((sum, transaction) => sum + transaction.amount_cents, 0);

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

      <div className="grid gap-6 lg:grid-cols-2">
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
      </div>
  </div>
  );
}
