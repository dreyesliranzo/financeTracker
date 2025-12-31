import type { Transaction, TransactionSplit } from "@/types";

export type TransactionWithSplits = Transaction & {
  transaction_splits?: TransactionSplit[] | null;
};

type Totals = {
  income: number;
  expense: number;
  net: number;
};

type CategoryTotal = Record<string, number>;

export function flattenSplits(transaction: TransactionWithSplits) {
  const kind = transaction.transaction_kind ?? transaction.type;
  if (kind === "transfer") return [];
  const splits = transaction.transaction_splits ?? [];
  if (splits.length === 0) {
    return [
      {
        category_id: transaction.category_id ?? null,
        amount_cents: transaction.amount_cents,
        kind
      }
    ];
  }
  return splits.map((split) => ({
    category_id: split.category_id ?? null,
    amount_cents: split.amount_cents,
    kind
  }));
}

export function sumIncomeExpense(transactions: TransactionWithSplits[]): Totals {
  return transactions.reduce<Totals>(
    (acc, txn) => {
      const kind = txn.transaction_kind ?? txn.type;
      if (kind === "transfer") return acc;
      const amount = txn.amount_cents;
      if (kind === "income") {
        acc.income += amount;
      } else {
        acc.expense += amount;
      }
      acc.net = acc.income - acc.expense;
      return acc;
    },
    { income: 0, expense: 0, net: 0 }
  );
}

export function categoryTotals(transactions: TransactionWithSplits[]): CategoryTotal {
  const totals: CategoryTotal = {};
  transactions.forEach((txn) => {
    flattenSplits(txn).forEach((line) => {
      const kind = line.kind;
      if (kind !== "expense") return;
      const key = line.category_id ?? "uncategorized";
      totals[key] = (totals[key] ?? 0) + line.amount_cents;
    });
  });
  return totals;
}
