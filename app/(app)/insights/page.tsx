"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCategories, fetchProfile, fetchTransactions } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";

export default function InsightsPage() {
  const currentMonth = new Date();
  const previousMonth = subMonths(currentMonth, 1);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const didSelectCurrency = useRef(false);

  const rangeStart = format(startOfMonth(previousMonth), "yyyy-MM-dd");
  const rangeEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", rangeStart, rangeEnd, selectedCurrency],
    queryFn: () => fetchTransactions({ start: rangeStart, end: rangeEnd }, selectedCurrency)
  });

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
    const currentKey = format(currentMonth, "yyyy-MM");
    const previousKey = format(previousMonth, "yyyy-MM");

    const currentItems = transactions.filter((transaction) =>
      transaction.date.startsWith(currentKey)
    );
    const previousItems = transactions.filter((transaction) =>
      transaction.date.startsWith(previousKey)
    );

    return { current: currentItems, previous: previousItems };
  }, [transactions, currentMonth, previousMonth]);

  const totals = useMemo(() => {
    const sum = (items: typeof current) =>
      items.reduce(
        (acc, transaction) => {
          if (transaction.type === "income") {
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
    const totalsByCategory = new Map<string, number>();
    current
      .filter((transaction) => transaction.type === "expense")
      .forEach((transaction) => {
        const key = transaction.category_id ?? "uncategorized";
        totalsByCategory.set(
          key,
          (totalsByCategory.get(key) ?? 0) + transaction.amount_cents
        );
      });

    return Array.from(totalsByCategory.entries())
      .map(([categoryId, amount]) => ({
        category: categoryNameMap.get(categoryId) ?? "Uncategorized",
        amount
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [current, categoryNameMap]);

  const topMerchants = useMemo(() => {
    const totalsByMerchant = new Map<string, number>();
    current
      .filter((transaction) => transaction.type === "expense")
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
      .filter((transaction) => transaction.type === "expense")
      .forEach((transaction) => {
        const day = format(new Date(transaction.date), "EEE");
        totalsByDay.set(day, (totalsByDay.get(day) ?? 0) + transaction.amount_cents);
      });

    const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return order.map((day) => ({ day, amount: totalsByDay.get(day) ?? 0 }));
  }, [current]);

  const incomeDelta = totals.current.income - totals.previous.income;
  const expenseDelta = totals.current.expense - totals.previous.expense;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-sm text-muted-foreground">
          Month-over-month comparisons and spending patterns.
        </p>
      </div>
      <div className="flex justify-end">
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
        <Card>
          <CardHeader>
            <CardTitle>Income delta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(incomeDelta, selectedCurrency)}
            </p>
            <p className="text-sm text-muted-foreground">
              vs {format(previousMonth, "MMMM")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expense delta</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(expenseDelta, selectedCurrency)}
            </p>
            <p className="text-sm text-muted-foreground">
              vs {format(previousMonth, "MMMM")}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topCategories.map((item) => (
              <div key={item.category} className="flex items-center justify-between text-sm">
                <span>{item.category}</span>
                <span className="font-medium">
                  {formatCurrency(item.amount, selectedCurrency)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
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

      <Card>
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
