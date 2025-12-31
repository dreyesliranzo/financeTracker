"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import {
  differenceInCalendarDays,
  endOfMonth,
  format,
  getDaysInMonth,
  parseISO,
  startOfMonth,
  subDays
} from "date-fns";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingText } from "@/components/ui/LoadingText";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  fetchAccounts,
  fetchBudgets,
  fetchCategories,
  fetchOverallBudgets,
  fetchProfile,
  fetchRecurringTransactions,
  fetchTransactionsSummary
} from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import {
  buildAccountBalances,
  buildAccountSummary,
  buildMerchantTotals,
  buildNetTrendSeries,
  buildNetWorthTrend,
  buildWeekdayTotals,
  categoryTotals,
  sumIncomeExpense,
  type TransactionWithSplits
} from "@/lib/utils/transactions";

const ChartFallback = () => (
  <div className="space-y-3">
    <LoadingText label="Loading chart" />
    <Skeleton className="h-64 w-full" />
  </div>
);

const NetTrendChart = dynamic(
  () => import("@/components/charts/NetTrendChart").then((mod) => mod.NetTrendChart),
  {
    ssr: false,
    loading: () => <ChartFallback />
  }
);

const NetWorthChart = dynamic(
  () => import("@/components/charts/NetWorthChart").then((mod) => mod.NetWorthChart),
  {
    ssr: false,
    loading: () => <ChartFallback />
  }
);

export default function InsightsPage() {
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const didSelectCurrency = useRef(false);
  const [rangeStart, setRangeStart] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [rangeEnd, setRangeEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const cardHover = "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10";
  const today = new Date();
  const currentMonthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const currentMonthEnd = format(endOfMonth(today), "yyyy-MM-dd");
  const analysisStart = format(subDays(today, 60), "yyyy-MM-dd");
  const duplicateStart = format(subDays(today, 30), "yyyy-MM-dd");
  const netWorthStart = format(subDays(today, 90), "yyyy-MM-dd");
  const daysInMonth = getDaysInMonth(today);

  const rangeStartDate = parseISO(rangeStart);
  const rangeEndDate = parseISO(rangeEnd);
  const dayCount = Math.max(
    1,
    differenceInCalendarDays(rangeEndDate, rangeStartDate) + 1
  );
  const previousStartDate = subDays(rangeStartDate, dayCount);
  const previousEndDate = subDays(rangeStartDate, 1);
  const previousStart = format(previousStartDate, "yyyy-MM-dd");
  const previousEnd = format(previousEndDate, "yyyy-MM-dd");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions", previousStart, rangeEnd, selectedCurrency],
    queryFn: () =>
      fetchTransactionsSummary(
        { start: previousStart, end: rangeEnd },
        selectedCurrency
      )
  });
  const transactions = (transactionsQuery.data ?? []) as TransactionWithSplits[];

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
    queryKey: ["budgets", currentMonthStart, selectedCurrency],
    queryFn: () => fetchBudgets(`${format(today, "yyyy-MM")}-01`, selectedCurrency)
  });
  const budgets = budgetsQuery.data ?? [];

  const overallBudgetsQuery = useQuery({
    queryKey: ["overall_budgets", currentMonthStart, selectedCurrency],
    queryFn: () => fetchOverallBudgets(`${format(today, "yyyy-MM")}-01`, selectedCurrency)
  });
  const overallBudget = overallBudgetsQuery.data?.[0] ?? null;

  const recurringQuery = useQuery({
    queryKey: ["recurring_transactions"],
    queryFn: fetchRecurringTransactions
  });
  const recurring = recurringQuery.data ?? [];

  const monthTransactionsQuery = useQuery({
    queryKey: ["transactions", currentMonthStart, currentMonthEnd, selectedCurrency, "month"],
    queryFn: () =>
      fetchTransactionsSummary(
        { start: currentMonthStart, end: currentMonthEnd },
        selectedCurrency
      )
  });
  const monthTransactions = (monthTransactionsQuery.data ?? []) as TransactionWithSplits[];

  const analysisTransactionsQuery = useQuery({
    queryKey: ["transactions", analysisStart, currentMonthEnd, selectedCurrency, "analysis"],
    queryFn: () =>
      fetchTransactionsSummary(
        { start: analysisStart, end: currentMonthEnd },
        selectedCurrency
      )
  });
  const analysisTransactions = (analysisTransactionsQuery.data ?? []) as TransactionWithSplits[];

  const allTransactionsQuery = useQuery({
    queryKey: ["transactions", "all", selectedCurrency],
    queryFn: () => fetchTransactionsSummary(undefined, selectedCurrency),
    staleTime: 5 * 60_000
  });
  const allTransactions = (allTransactionsQuery.data ?? []) as TransactionWithSplits[];

  const isLoading =
    transactionsQuery.isLoading ||
    categoriesQuery.isLoading ||
    accountsQuery.isLoading ||
    budgetsQuery.isLoading ||
    overallBudgetsQuery.isLoading ||
    recurringQuery.isLoading ||
    monthTransactionsQuery.isLoading ||
    analysisTransactionsQuery.isLoading ||
    allTransactionsQuery.isLoading;

  useEffect(() => {
    if (!profile?.default_currency) return;
    if (didSelectCurrency.current) return;
    setSelectedCurrency(profile.default_currency);
  }, [profile?.default_currency]);

  const navigateToTransactions = (params: Record<string, string | undefined>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) query.set(key, value);
    });
    const queryString = query.toString();
    const href = queryString ? `/transactions?${queryString}` : "/transactions";
    router.push(href as Route);
  };

  const categoryNameMap = useMemo(() => {
    return new Map(
      categories
        .filter((category) => Boolean(category.id))
        .map((category) => [category.id!, category.name])
    );
  }, [categories]);

  const { current, previous } = useMemo(() => {
    const currentItems = transactions.filter(
      (transaction) =>
        transaction.date >= rangeStart && transaction.date <= rangeEnd
    );
    const previousItems = transactions.filter(
      (transaction) =>
        transaction.date >= previousStart && transaction.date <= previousEnd
    );

    return { current: currentItems, previous: previousItems };
  }, [previousEnd, previousStart, rangeEnd, rangeStart, transactions]);

  const totals = useMemo(() => {
    return {
      current: sumIncomeExpense(current),
      previous: sumIncomeExpense(previous)
    };
  }, [current, previous]);

  const topCategories = useMemo(() => {
    const totalsByCategory = categoryTotals(current);
    return Object.entries(totalsByCategory)
      .map(([categoryId, amount]) => ({
        categoryId,
        category: categoryNameMap.get(categoryId) ?? "Uncategorized",
        amount
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [current, categoryNameMap]);

  const topMerchants = useMemo(() => {
    const totalsByMerchant = buildMerchantTotals(current);
    return Array.from(totalsByMerchant.entries())
      .map(([merchant, amount]) => ({ merchant, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [current]);

  const weekdaySpend = useMemo(() => {
    const totalsByDay = buildWeekdayTotals(current);
    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return order.map((day) => ({ day, amount: totalsByDay[day] ?? 0 }));
  }, [current]);

  const incomeDelta = totals.current.income - totals.previous.income;
  const expenseDelta = totals.current.expense - totals.previous.expense;

  const netTrend = useMemo(() => {
    return buildNetTrendSeries(current, { scale: 100 });
  }, [current]);

  const selectedCategoryName = selectedCategory
    ? categoryNameMap.get(selectedCategory) ?? "Uncategorized"
    : null;
  const selectedCategoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return current
      .filter((transaction) => {
        if (selectedCategory === "uncategorized") {
          return !transaction.category_id && (transaction.transaction_splits?.length ?? 0) === 0;
        }
        if (transaction.transaction_splits?.length) {
          return transaction.transaction_splits.some(
            (split) => split.category_id === selectedCategory
          );
        }
        return transaction.category_id === selectedCategory;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [current, selectedCategory]);

  const accountBalances = useMemo(() => {
    return buildAccountBalances(accounts, allTransactions, selectedCurrency);
  }, [accounts, allTransactions, selectedCurrency]);

  const accountSummary = useMemo(() => {
    return buildAccountSummary(accounts, accountBalances, selectedCurrency);
  }, [accountBalances, accounts, selectedCurrency]);

  const monthTotals = useMemo(() => {
    return sumIncomeExpense(monthTransactions);
  }, [monthTransactions]);

  const upcomingRecurring = useMemo(() => {
    const todayStr = format(today, "yyyy-MM-dd");
    return recurring.filter(
      (item) =>
        item.active &&
        item.next_run &&
        item.next_run >= todayStr &&
        item.next_run <= currentMonthEnd
    );
  }, [currentMonthEnd, recurring, today]);

  const upcomingNet = useMemo(() => {
    return upcomingRecurring.reduce((sum, item) => {
      const delta = item.type === "income" ? item.amount_cents : -item.amount_cents;
      return sum + delta;
    }, 0);
  }, [upcomingRecurring]);

  const budgetLimit = useMemo(() => {
    if (overallBudget?.limit_cents) return overallBudget.limit_cents;
    return budgets.reduce((sum, budget) => sum + budget.limit_cents, 0);
  }, [budgets, overallBudget]);

  const elapsedDays = Math.max(
    1,
    differenceInCalendarDays(today, startOfMonth(today)) + 1
  );
  const remainingDays = Math.max(
    1,
    differenceInCalendarDays(endOfMonth(today), today) + 1
  );
  const paceLimit = budgetLimit ? budgetLimit * (elapsedDays / daysInMonth) : 0;
  const overspend = Math.max(0, monthTotals.expense - paceLimit);

  const safeToSpend = useMemo(() => {
    const safeThisMonth = accountSummary.total + upcomingNet - overspend;
    const safeToday = safeThisMonth / remainingDays;
    const paceRatio = paceLimit ? monthTotals.expense / paceLimit : 0;
    return {
      safeThisMonth,
      safeToday,
      paceRatio
    };
  }, [accountSummary.total, upcomingNet, overspend, remainingDays, paceLimit, monthTotals.expense]);

  const forecast = useMemo(() => {
    const netToDate = monthTotals.net;
    const dailyNet = netToDate / elapsedDays;
    const projectedNet = netToDate + dailyNet * (daysInMonth - elapsedDays) + upcomingNet;
    return {
      netToDate,
      dailyNet,
      projectedNet
    };
  }, [daysInMonth, elapsedDays, monthTotals.net, upcomingNet]);

  const anomalies = useMemo(() => {
    const recentStart = format(subDays(today, 7), "yyyy-MM-dd");
    const baselineStart = format(subDays(today, 37), "yyyy-MM-dd");
    const baselineEnd = format(subDays(today, 8), "yyyy-MM-dd");
    const recentTransactions = analysisTransactions.filter(
      (transaction) => transaction.date >= recentStart && transaction.date <= currentMonthEnd
    );
    const baselineTransactions = analysisTransactions.filter(
      (transaction) =>
        transaction.date >= baselineStart && transaction.date <= baselineEnd
    );

    const recentTotals = categoryTotals(recentTransactions);
    const baselineTotals = categoryTotals(baselineTransactions);
    const anomaliesList = Object.entries(recentTotals)
      .map(([categoryId, recentTotal]) => {
        const baselineTotal = baselineTotals[categoryId] ?? 0;
        const baselineWeekly = baselineTotal ? (baselineTotal / 30) * 7 : 0;
        const ratio = baselineWeekly ? recentTotal / baselineWeekly : recentTotal > 0 ? 999 : 0;
        return {
          categoryId,
          category: categoryNameMap.get(categoryId) ?? "Uncategorized",
          recentTotal,
          baselineWeekly,
          ratio
        };
      })
      .filter((item) => {
        const threshold = Math.max(5000, item.baselineWeekly * 1.6);
        return item.recentTotal >= threshold;
      })
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5);

    return anomaliesList;
  }, [analysisTransactions, categoryNameMap, currentMonthEnd, today]);

  const duplicates = useMemo(() => {
    const recentTransactions = analysisTransactions.filter(
      (transaction) => transaction.date >= duplicateStart
    );
    const groups = new Map<string, TransactionWithSplits[]>();

    recentTransactions.forEach((transaction) => {
      const kind = transaction.transaction_kind ?? transaction.type;
      if (kind !== "expense") return;
      if (!transaction.merchant) return;
      const key = `${transaction.merchant.toLowerCase()}-${transaction.amount_cents}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(transaction);
    });

    const results: Array<{
      merchant: string;
      amount: number;
      date: string;
      matchDate: string;
      daysApart: number;
    }> = [];

    groups.forEach((items) => {
      items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      for (let i = 1; i < items.length; i += 1) {
        const prev = items[i - 1];
        const current = items[i];
        const daysApart = Math.abs(
          differenceInCalendarDays(parseISO(current.date), parseISO(prev.date))
        );
        if (daysApart <= 2) {
          results.push({
            merchant: current.merchant ?? "Unknown",
            amount: current.amount_cents,
            date: prev.date,
            matchDate: current.date,
            daysApart
          });
        }
      }
    });

    return results.slice(0, 5);
  }, [analysisTransactions, duplicateStart]);

  const netWorthTrend = useMemo(() => {
    return buildNetWorthTrend({
      accounts,
      transactions: allTransactions,
      startDate: netWorthStart,
      endDate: format(today, "yyyy-MM-dd"),
      currencyCode: selectedCurrency
    });
  }, [accounts, allTransactions, netWorthStart, selectedCurrency, today]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Month-over-month comparisons and spending patterns.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={rangeStart}
            onChange={(event) => setRangeStart(event.target.value)}
            className="w-[160px]"
          />
          <Input
            type="date"
            value={rangeEnd}
            onChange={(event) => setRangeEnd(event.target.value)}
            className="w-[160px]"
          />
          <p className="text-xs text-muted-foreground">
            Comparing previous {dayCount} days
          </p>
        </div>
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Income delta</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <LoadingText label="Loading income" />
                <Skeleton className="h-8 w-28" />
              </div>
            ) : (
              <p className="text-2xl font-semibold">
                {formatCurrency(incomeDelta, selectedCurrency)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              vs previous {dayCount} days
            </p>
          </CardContent>
        </Card>
        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Expense delta</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <LoadingText label="Loading expenses" />
                <Skeleton className="h-8 w-28" />
              </div>
            ) : (
              <p className="text-2xl font-semibold">
                {formatCurrency(expenseDelta, selectedCurrency)}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              vs previous {dayCount} days
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className={cardHover}>
        <CardHeader>
          <CardTitle>Net trend</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <ChartFallback /> : <NetTrendChart data={netTrend} />}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Safe to spend</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <LoadingText label="Loading balances" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-2xl font-semibold">
                    {formatCurrency(safeToSpend.safeThisMonth, selectedCurrency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Safe for the rest of the month
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    Today: {formatCurrency(Math.round(safeToSpend.safeToday), selectedCurrency)}
                  </span>
                  <span>
                    Upcoming recurring: {formatCurrency(upcomingNet, selectedCurrency)}
                  </span>
                  <span>
                    Budget pace: {Math.round(safeToSpend.paceRatio * 100)}%
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigateToTransactions({
                      start: currentMonthStart,
                      end: currentMonthEnd
                    })
                  }
                >
                  View transactions
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Forecast</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <LoadingText label="Loading forecast" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-2xl font-semibold">
                    {formatCurrency(Math.round(forecast.projectedNet), selectedCurrency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Projected month net
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    Trend/day: {formatCurrency(Math.round(forecast.dailyNet), selectedCurrency)}
                  </span>
                  <span>
                    Net so far: {formatCurrency(forecast.netToDate, selectedCurrency)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigateToTransactions({
                      start: currentMonthStart,
                      end: currentMonthEnd
                    })
                  }
                >
                  View transactions
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={cardHover}>
        <CardHeader>
          <CardTitle>Net worth trend</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? <ChartFallback /> : <NetWorthChart data={netWorthTrend} />}
          {!isLoading ? (
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>Assets: {formatCurrency(accountSummary.assets, selectedCurrency)}</span>
              <span>Liabilities: {formatCurrency(accountSummary.liabilities, selectedCurrency)}</span>
              <span>Net: {formatCurrency(accountSummary.total, selectedCurrency)}</span>
            </div>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigateToTransactions({
                start: netWorthStart,
                end: currentMonthEnd
              })
            }
          >
            View transactions
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Anomalies</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <LoadingText label="Scanning categories" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : anomalies.length ? (
              anomalies.map((item) => (
                <button
                  key={item.categoryId}
                  type="button"
                  onClick={() =>
                    navigateToTransactions({
                      category: item.categoryId,
                      start: format(subDays(today, 7), "yyyy-MM-dd"),
                      end: currentMonthEnd
                    })
                  }
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{item.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.recentTotal, selectedCurrency)} in 7 days
                    </p>
                  </div>
                  <Badge variant="secondary">Spike</Badge>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No unusual category spikes detected.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Potential duplicates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <LoadingText label="Scanning duplicates" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : duplicates.length ? (
              duplicates.map((item, index) => (
                <button
                  key={`${item.merchant}-${item.date}-${index}`}
                  type="button"
                  onClick={() =>
                    navigateToTransactions({
                      search: item.merchant,
                      start: item.date,
                      end: item.matchDate
                    })
                  }
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted/40"
                >
                  <div>
                    <p className="font-medium">{item.merchant}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatCurrency(item.amount, selectedCurrency)} on {item.date} and {item.matchDate}
                    </p>
                  </div>
                  <Badge variant="secondary">Duplicate</Badge>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No duplicates detected in the last 30 days.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Top categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <LoadingText label="Loading categories" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            ) : (
              topCategories.map((item) => (
                <Dialog key={item.categoryId}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(item.categoryId)}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition hover:bg-muted/40"
                    >
                      <span>{item.category}</span>
                      <span className="font-medium">
                        {formatCurrency(item.amount, selectedCurrency)}
                      </span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{selectedCategoryName ?? "Category detail"}</DialogTitle>
                    </DialogHeader>
                    <div className="rounded-xl border border-border/60">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Merchant</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedCategoryTransactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>{transaction.date}</TableCell>
                              <TableCell>{transaction.merchant ?? "-"}</TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(transaction.amount_cents, selectedCurrency)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {selectedCategoryTransactions.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                                No transactions in this range.
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </div>
                  </DialogContent>
                </Dialog>
              ))
            )}
          </CardContent>
        </Card>
        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Top merchants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">
                <LoadingText label="Loading merchants" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            ) : (
              topMerchants.map((item) => (
                <div key={item.merchant} className="flex items-center justify-between text-sm">
                  <span>{item.merchant}</span>
                  <span className="font-medium">
                    {formatCurrency(item.amount, selectedCurrency)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={cardHover}>
        <CardHeader>
          <CardTitle>Weekday spend distribution</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-7">
          {isLoading ? (
            <div className="col-span-full space-y-2">
              <LoadingText label="Loading distribution" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            weekdaySpend.map((item) => (
              <div key={item.day} className="rounded-xl border border-border/60 p-3 text-center">
                <p className="text-xs text-muted-foreground">{item.day}</p>
                <p className="mt-2 text-sm font-semibold">
                  {formatCurrency(item.amount, selectedCurrency)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
