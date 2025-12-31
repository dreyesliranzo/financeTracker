import { addDays, format, parseISO } from "date-fns";
import type { Transaction, TransactionSplit } from "@/types";

export type TransactionWithSplits = Transaction & {
  transaction_splits?: TransactionSplit[] | null;
};

export type TransactionKind = "income" | "expense" | "transfer";

export type Totals = {
  income: number;
  expense: number;
  net: number;
};

export type CategoryTotal = Record<string, number>;

export type TransactionLine = {
  kind: TransactionKind;
  amount_cents: number;
  category_id: string | null;
  transaction_id?: string;
  split_id?: string;
};

export type CashflowPoint = {
  date: string;
  income: number;
  expense: number;
};

export type NetTrendPoint = {
  date: string;
  net: number;
};

export type AccountLike = {
  id?: string | null;
  type?: string | null;
  account_class?: "asset" | "liability" | null;
  currency_code?: string | null;
};

export function getTransactionKind(transaction: TransactionWithSplits): TransactionKind {
  return (transaction.transaction_kind ?? transaction.type) as TransactionKind;
}

export function isTransfer(transaction: TransactionWithSplits): boolean {
  return getTransactionKind(transaction) === "transfer";
}

export function flattenSplits(transaction: TransactionWithSplits): TransactionLine[] {
  const kind = getTransactionKind(transaction);
  if (kind === "transfer") return [];

  const splits = transaction.transaction_splits ?? [];
  if (splits.length === 0) {
    return [
      {
        kind,
        category_id: transaction.category_id ?? null,
        amount_cents: transaction.amount_cents,
        transaction_id: transaction.id
      }
    ];
  }

  return splits.map((split) => ({
    kind,
    category_id: split.category_id ?? null,
    amount_cents: split.amount_cents,
    transaction_id: transaction.id,
    split_id: split.id
  }));
}

export function sumIncomeExpense(transactions: TransactionWithSplits[]): Totals {
  return transactions.reduce<Totals>(
    (acc, transaction) => {
      const kind = getTransactionKind(transaction);
      if (kind === "transfer") return acc;
      if (kind === "income") {
        acc.income += transaction.amount_cents;
      } else {
        acc.expense += transaction.amount_cents;
      }
      acc.net = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );
}

export function sumExpenseLines(transactions: TransactionWithSplits[]): number {
  return transactions.reduce((sum, transaction) => {
    flattenSplits(transaction).forEach((line) => {
      if (line.kind === "expense") {
        sum += line.amount_cents;
      }
    });
    return sum;
  }, 0);
}

export function categoryTotals(transactions: TransactionWithSplits[]): CategoryTotal {
  const totals: CategoryTotal = {};
  transactions.forEach((transaction) => {
    flattenSplits(transaction).forEach((line) => {
      if (line.kind !== "expense") return;
      const key = line.category_id ?? "uncategorized";
      totals[key] = (totals[key] ?? 0) + line.amount_cents;
    });
  });
  return totals;
}

export function buildCashflowSeries(
  transactions: TransactionWithSplits[],
  options?: { scale?: number }
): CashflowPoint[] {
  const scale = options?.scale ?? 1;
  const byDate = new Map<string, { income: number; expense: number }>();
  transactions.forEach((transaction) => {
    const kind = getTransactionKind(transaction);
    if (kind === "transfer") return;
    if (!byDate.has(transaction.date)) {
      byDate.set(transaction.date, { income: 0, expense: 0 });
    }
    const entry = byDate.get(transaction.date)!;
    if (kind === "income") {
      entry.income += transaction.amount_cents / scale;
    } else {
      entry.expense += transaction.amount_cents / scale;
    }
  });

  return Array.from(byDate.entries())
    .map(([date, values]) => ({ date, ...values }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function buildNetTrendSeries(
  transactions: TransactionWithSplits[],
  options?: { scale?: number }
): NetTrendPoint[] {
  const scale = options?.scale ?? 1;
  const daily = new Map<string, number>();
  transactions.forEach((transaction) => {
    const kind = getTransactionKind(transaction);
    if (kind === "transfer") return;
    const value = kind === "income" ? transaction.amount_cents : -transaction.amount_cents;
    daily.set(transaction.date, (daily.get(transaction.date) ?? 0) + value);
  });

  return Array.from(daily.entries())
    .map(([date, net]) => ({ date, net: Math.round(net / scale) }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function buildMerchantTotals(
  transactions: TransactionWithSplits[]
): Map<string, number> {
  const totals = new Map<string, number>();
  transactions.forEach((transaction) => {
    const kind = getTransactionKind(transaction);
    if (kind !== "expense") return;
    if (!transaction.merchant) return;
    const key = transaction.merchant;
    totals.set(key, (totals.get(key) ?? 0) + transaction.amount_cents);
  });
  return totals;
}

export function buildWeekdayTotals(
  transactions: TransactionWithSplits[]
): Record<string, number> {
  const totals: Record<string, number> = {
    Mon: 0,
    Tue: 0,
    Wed: 0,
    Thu: 0,
    Fri: 0,
    Sat: 0,
    Sun: 0
  };
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  transactions.forEach((transaction) => {
    const day = labels[new Date(transaction.date).getDay()] ?? "Mon";
    flattenSplits(transaction).forEach((line) => {
      if (line.kind !== "expense") return;
      totals[day] = (totals[day] ?? 0) + line.amount_cents;
    });
  });
  return totals;
}

export function buildAccountBalances(
  accounts: AccountLike[],
  transactions: TransactionWithSplits[],
  currencyCode?: string
): Map<string, number> {
  const balances = new Map<string, number>();
  accounts.forEach((account) => {
    if (!account.id) return;
    if (currencyCode && account.currency_code && account.currency_code !== currencyCode) return;
    balances.set(account.id, 0);
  });

  const applyDelta = (accountId: string | null | undefined, delta: number) => {
    if (!accountId) return;
    if (!balances.has(accountId)) return;
    balances.set(accountId, (balances.get(accountId) ?? 0) + delta);
  };

  transactions.forEach((transaction) => {
    const kind = getTransactionKind(transaction);
    if (currencyCode && transaction.currency_code && transaction.currency_code !== currencyCode) {
      return;
    }
    if (kind === "transfer") {
      applyDelta(transaction.from_account_id ?? null, -transaction.amount_cents);
      applyDelta(transaction.to_account_id ?? null, transaction.amount_cents);
      return;
    }
    const sign = kind === "income" ? 1 : -1;
    applyDelta(transaction.account_id ?? null, sign * transaction.amount_cents);
  });

  return balances;
}

export function buildAccountSummary(
  accounts: AccountLike[],
  balances: Map<string, number>,
  currencyCode?: string
) {
  let assets = 0;
  let liabilities = 0;

  accounts.forEach((account) => {
    if (!account.id) return;
    if (currencyCode && account.currency_code && account.currency_code !== currencyCode) return;
    const balance = balances.get(account.id) ?? 0;
    const accountClass =
      account.account_class ?? (account.type === "credit" ? "liability" : "asset");
    if (accountClass === "liability") {
      liabilities += balance;
    } else {
      assets += balance;
    }
  });

  return {
    assets,
    liabilities,
    total: assets + liabilities
  };
}

export function buildNetWorthTrend(options: {
  accounts: AccountLike[];
  transactions: TransactionWithSplits[];
  startDate: string;
  endDate: string;
  currencyCode?: string;
  labelFormat?: string;
}) {
  const { accounts, transactions, startDate, endDate, currencyCode, labelFormat = "MMM d" } =
    options;
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const balances = new Map<string, number>();

  accounts.forEach((account) => {
    if (!account.id) return;
    if (currencyCode && account.currency_code && account.currency_code !== currencyCode) return;
    balances.set(account.id, 0);
  });

  const applyDelta = (accountId: string | null | undefined, delta: number) => {
    if (!accountId) return;
    if (!balances.has(accountId)) return;
    balances.set(accountId, (balances.get(accountId) ?? 0) + delta);
  };

  const byDate = new Map<string, TransactionWithSplits[]>();

  transactions.forEach((transaction) => {
    const kind = getTransactionKind(transaction);
    if (currencyCode && transaction.currency_code && transaction.currency_code !== currencyCode) {
      return;
    }
    if (transaction.date < startDate) {
      if (kind === "transfer") {
        applyDelta(transaction.from_account_id ?? null, -transaction.amount_cents);
        applyDelta(transaction.to_account_id ?? null, transaction.amount_cents);
      } else {
        const sign = kind === "income" ? 1 : -1;
        applyDelta(transaction.account_id ?? null, sign * transaction.amount_cents);
      }
      return;
    }

    if (transaction.date > endDate) return;
    if (!byDate.has(transaction.date)) byDate.set(transaction.date, []);
    byDate.get(transaction.date)!.push(transaction);
  });

  const points: Array<{ date: string; balance: number }> = [];
  let cursor = start;
  while (cursor <= end) {
    const dateKey = format(cursor, "yyyy-MM-dd");
    const daily = byDate.get(dateKey) ?? [];
    daily.forEach((transaction) => {
      const kind = getTransactionKind(transaction);
      if (kind === "transfer") {
        applyDelta(transaction.from_account_id ?? null, -transaction.amount_cents);
        applyDelta(transaction.to_account_id ?? null, transaction.amount_cents);
      } else {
        const sign = kind === "income" ? 1 : -1;
        applyDelta(transaction.account_id ?? null, sign * transaction.amount_cents);
      }
    });

    const total = Array.from(balances.values()).reduce((sum, value) => sum + value, 0);
    points.push({ date: format(cursor, labelFormat), balance: Math.round(total / 100) });
    cursor = addDays(cursor, 1);
  }

  return points;
}
