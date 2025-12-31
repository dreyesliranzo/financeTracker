"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, format, parseISO, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchProfile, fetchTransactionsSummary } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { SavingsProjectionChart } from "@/components/charts/SavingsProjectionChart";

const cadenceOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" }
] as const;

const baseOptions = [
  { value: "income", label: "Average income" },
  { value: "net", label: "Average net" },
  { value: "custom", label: "Custom amount" }
] as const;

export default function ProjectionsPage() {
  const [rangeStart, setRangeStart] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [rangeEnd, setRangeEnd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [percent, setPercent] = useState("10");
  const [cadence, setCadence] = useState("monthly");
  const [horizonMonths, setHorizonMonths] = useState("12");
  const [baseMode, setBaseMode] = useState("income");
  const [customBase, setCustomBase] = useState("");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const didSelectCurrency = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });

  useEffect(() => {
    if (!profile?.default_currency) return;
    if (didSelectCurrency.current) return;
    setSelectedCurrency(profile.default_currency);
  }, [profile?.default_currency]);

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", "summary", rangeStart, rangeEnd, selectedCurrency],
    queryFn: () =>
      fetchTransactionsSummary(
        { start: rangeStart, end: rangeEnd },
        selectedCurrency
      )
  });

  const totals = useMemo(() => {
    return transactions.reduce(
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
  }, [transactions]);

  const baseStats = useMemo(() => {
    const startDate = parseISO(rangeStart);
    const endDate = parseISO(rangeEnd);
    const dayCount = Math.max(1, differenceInCalendarDays(endDate, startDate) + 1);
    const incomePerDay = totals.income / dayCount;
    const netPerDay = (totals.income - totals.expense) / dayCount;

    return {
      dayCount,
      incomePerDay,
      netPerDay,
      incomePerMonth: incomePerDay * 30,
      netPerMonth: netPerDay * 30,
      incomePerYear: incomePerDay * 365,
      netPerYear: netPerDay * 365
    };
  }, [rangeEnd, rangeStart, totals.expense, totals.income]);

  const projection = useMemo(() => {
    const percentValue = Number(percent) || 0;
    const horizonValue = Number(horizonMonths) || 0;
    const baseValue = Number(customBase) || 0;

    const baseAmount =
      baseMode === "custom"
        ? baseValue * 100
        : baseMode === "net"
        ? Math.max(0, baseStats.netPerMonth)
        : baseStats.incomePerMonth;

    const cadenceMultiplier =
      cadence === "daily"
        ? baseAmount / 30
        : cadence === "weekly"
        ? baseAmount / 4
        : cadence === "yearly"
        ? baseAmount * 12
        : baseAmount;

    const contributionPerPeriod = (cadenceMultiplier * percentValue) / 100;
    const periodCount =
      cadence === "daily"
        ? horizonValue * 30
        : cadence === "weekly"
        ? horizonValue * 4
        : cadence === "yearly"
        ? Math.max(1, Math.round(horizonValue / 12))
        : horizonValue;

    const total = contributionPerPeriod * periodCount;

    const points = Array.from({ length: Math.max(1, periodCount) }).map((_, index) => {
      const step = index + 1;
      const label =
        cadence === "daily"
          ? `Day ${step}`
          : cadence === "weekly"
          ? `Week ${step}`
          : cadence === "yearly"
          ? `Year ${step}`
          : `Month ${step}`;
      return {
        label,
        total: Math.round((contributionPerPeriod * step) / 100)
      };
    });

    return {
      contributionPerPeriod,
      total,
      periodCount,
      points
    };
  }, [
    baseMode,
    baseStats.incomePerMonth,
    baseStats.netPerMonth,
    cadence,
    customBase,
    horizonMonths,
    percent
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Projections</h1>
        <p className="text-sm text-muted-foreground">
          Estimate how much you could save by allocating a percentage over time.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Projection inputs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Data range</p>
            <div className="flex flex-wrap gap-2">
              <Input type="date" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
              <Input type="date" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Percent to save</p>
            <Input value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="10" />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Cadence</p>
            <Select value={cadence} onValueChange={setCadence}>
              <SelectTrigger>
                <SelectValue placeholder="Select cadence" />
              </SelectTrigger>
              <SelectContent>
                {cadenceOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Projection length (months)</p>
            <Input
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(e.target.value)}
              placeholder="12"
            />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Base amount</p>
            <Select value={baseMode} onValueChange={setBaseMode}>
              <SelectTrigger>
                <SelectValue placeholder="Select base" />
              </SelectTrigger>
              <SelectContent>
                {baseOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {baseMode === "custom" ? (
              <Input
                value={customBase}
                onChange={(e) => setCustomBase(e.target.value)}
                placeholder="Custom amount"
              />
            ) : null}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Currency</p>
            <Select
              value={selectedCurrency}
              onValueChange={(value) => {
                didSelectCurrency.current = true;
                setSelectedCurrency(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
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
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Per period</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(Math.round(projection.contributionPerPeriod), selectedCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total saved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {formatCurrency(Math.round(projection.total), selectedCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Periods</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{projection.periodCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Savings curve</CardTitle>
        </CardHeader>
        <CardContent>
          <SavingsProjectionChart data={projection.points} />
        </CardContent>
      </Card>
    </div>
  );
}
