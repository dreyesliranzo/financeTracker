"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchCategories, fetchProfile, fetchTransactionsSummary } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { NetTrendChart } from "@/components/charts/NetTrendChart";
import { categoryTotals, flattenSplits, type TransactionWithSplits } from "@/lib/utils/transactions";

export default function InsightsPage() {
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const didSelectCurrency = useRef(false);
  const [rangeStart, setRangeStart] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [rangeEnd, setRangeEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const cardHover = "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/10";

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

  const { data: transactionsRaw = [] } = useQuery({
    queryKey: ["transactions", previousStart, rangeEnd, selectedCurrency],
    queryFn: () =>
      fetchTransactionsSummary(
        { start: previousStart, end: rangeEnd },
        selectedCurrency
      )
  });
  const transactions = transactionsRaw as TransactionWithSplits[];

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

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
    const sum = (items: typeof current) =>
      items.reduce(
        (acc, transaction) => {
          const kind = transaction.transaction_kind ?? transaction.type;
          if (kind === "transfer") return acc;
          if (kind === "income") {
            acc.income += transaction.amount_cents;
          } else {
            acc.expense += transaction.amount_cents;
          }
          return acc;
        },
        { income: 0, expense: 0 }
      );

    return {
      current: sum(current),
      previous: sum(previous)
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
    const totalsByMerchant = new Map<string, number>();
    current
      .filter((transaction) => (transaction.transaction_kind ?? transaction.type) === "expense")
      .forEach((transaction) => {
        if (!transaction.merchant) return;
        totalsByMerchant.set(
          transaction.merchant,
          (totalsByMerchant.get(transaction.merchant) ?? 0) +
            transaction.amount_cents
        );
      });

    return Array.from(totalsByMerchant.entries())
      .map(([merchant, amount]) => ({ merchant, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [current]);

  const weekdaySpend = useMemo(() => {
    const totalsByDay = new Map<string, number>();
    current
      .filter((transaction) => (transaction.transaction_kind ?? transaction.type) === "expense")
      .forEach((transaction) => {
        const day = format(new Date(transaction.date), "EEE");
        flattenSplits(transaction).forEach((line) => {
          if (line.kind !== "expense") return;
          totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + line.amount_cents);
        });
      });

    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return order.map((day) => ({ day, amount: totalsByDay.get(day) ?? 0 }));
  }, [current]);

  const incomeDelta = totals.current.income - totals.previous.income;
  const expenseDelta = totals.current.expense - totals.previous.expense;

  const netTrend = useMemo(() => {
    const daily = new Map<string, number>();
    current.forEach((transaction) => {
      const kind = transaction.transaction_kind ?? transaction.type;
      if (kind === "transfer") return;
      const value = kind === "income" ? transaction.amount_cents : -transaction.amount_cents;
      daily.set(transaction.date, (daily.get(transaction.date) ?? 0) + value);
    });
    return Array.from(daily.entries())
      .map(([date, net]) => ({ date, net: Math.round(net / 100) }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
            <p className="text-2xl font-semibold">
              {formatCurrency(incomeDelta, selectedCurrency)}
            </p>
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
            <p className="text-2xl font-semibold">
              {formatCurrency(expenseDelta, selectedCurrency)}
            </p>
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
          <NetTrendChart data={netTrend} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Top categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCategories.map((item) => (
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
            ))}
          </CardContent>
        </Card>
        <Card className={cardHover}>
          <CardHeader>
            <CardTitle>Top merchants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topMerchants.map((item) => (
              <div key={item.merchant} className="flex items-center justify-between text-sm">
                <span>{item.merchant}</span>
                <span className="font-medium">
                  {formatCurrency(item.amount, selectedCurrency)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className={cardHover}>
        <CardHeader>
          <CardTitle>Weekday spend distribution</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-7">
          {weekdaySpend.map((item) => (
            <div key={item.day} className="rounded-xl border border-border/60 p-3 text-center">
              <p className="text-xs text-muted-foreground">{item.day}</p>
              <p className="mt-2 text-sm font-semibold">
                {formatCurrency(item.amount, selectedCurrency)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
