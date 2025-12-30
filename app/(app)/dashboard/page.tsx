"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchBudgets, fetchCategories, fetchTransactions } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/money";
import { ExpenseByCategoryChart } from "@/components/charts/ExpenseByCategoryChart";
import { CashflowChart } from "@/components/charts/CashflowChart";
import { BudgetProgressList } from "@/components/charts/BudgetProgressList";

export default function DashboardPage() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const rangeStart = format(startOfMonth(new Date(`${month}-01`)), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(new Date(`${month}-01`)), "yyyy-MM-dd");

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", rangeStart, rangeEnd],
    queryFn: () => fetchTransactions({ start: rangeStart, end: rangeEnd })
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", month],
    queryFn: () => fetchBudgets(`${month}-01`)
  });

  const { income, expense, net } = useMemo(() => {
    return transactions.reduce(
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
  }, [transactions]);

  const remainingBudget = useMemo(() => {
    const totalLimit = budgets.reduce((sum, budget) => sum + budget.limit_cents, 0);
    return totalLimit - expense;
  }, [budgets, expense]);

  const expenseByCategory = useMemo(() => {
    const totals = new Map<string, number>();
    transactions
      .filter((transaction) => transaction.type === "expense")
      .forEach((transaction) => {
        const key = transaction.category_id ?? "uncategorized";
        totals.set(key, (totals.get(key) ?? 0) + transaction.amount_cents);
      });

    return Array.from(totals.entries())
      .map(([categoryId, value]) => ({
        name: categories.find((cat) => cat.id === categoryId)?.name ?? "Uncategorized",
        value: Math.round(value / 100)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [transactions, categories]);

  const cashflowData = useMemo(() => {
    const byDate = new Map<string, { income: number; expense: number }>();
    transactions.forEach((transaction) => {
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
  }, [transactions]);

  const budgetProgress = useMemo(() => {
    return budgets.map((budget) => {
      const spent = transactions
        .filter(
          (transaction) =>
            transaction.type === "expense" &&
            transaction.category_id === budget.category_id
        )
        .reduce((sum, transaction) => sum + transaction.amount_cents, 0);

      return {
        category:
          categories.find((cat) => cat.id === budget.category_id)?.name ??
          "Uncategorized",
        spent,
        limit: budget.limit_cents
      };
    });
  }, [budgets, transactions, categories]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Financial overview</h1>
          <p className="text-sm text-muted-foreground">
            Track your month at a glance.
          </p>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
          className="w-[170px]"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatCurrency(net)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-emerald-400">
              {formatCurrency(income)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-rose-400">
              {formatCurrency(expense)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Remaining budget
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatCurrency(remainingBudget)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseByCategoryChart data={expenseByCategory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cashflow</CardTitle>
          </CardHeader>
          <CardContent>
            <CashflowChart data={cashflowData} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Budget progress</CardTitle>
        </CardHeader>
        <CardContent>
          {budgetProgress.length > 0 ? (
            <BudgetProgressList items={budgetProgress} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Set a budget to track your progress.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
