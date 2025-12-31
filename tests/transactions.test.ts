// @ts-nocheck
import { strict as assert } from "node:assert";
import { categoryTotals, sumIncomeExpense, flattenSplits } from "../lib/utils/transactions";

const baseTx = (overrides = {}) => ({
  id: "t1",
  user_id: "u1",
  date: "2025-01-01",
  amount_cents: 10000,
  type: "expense",
  transaction_kind: "expense",
  category_id: null,
  account_id: null,
  currency_code: "USD",
  transaction_splits: null,
  ...overrides
});

const transfers = [
  baseTx({ id: "x1", transaction_kind: "transfer", type: "transfer" }),
  baseTx({ id: "x2", transaction_kind: "transfer", type: "transfer" })
];

const splitTx = baseTx({
  id: "s1",
  transaction_splits: [
    { id: "s1a", category_id: "c1", amount_cents: 4000 },
    { id: "s1b", category_id: "c2", amount_cents: 6000 }
  ]
});

const mixed = [
  baseTx({ id: "i1", transaction_kind: "income", type: "income", amount_cents: 20000 }),
  baseTx({ id: "e1", transaction_kind: "expense", type: "expense", amount_cents: 5000, category_id: "c3" }),
  splitTx,
  ...transfers
];

// Income/expense totals exclude transfers and split correctly
const totals = sumIncomeExpense(mixed);
assert.equal(totals.income, 20000);
assert.equal(totals.expense, 5000 + 10000);
assert.equal(totals.net, 10000);

// Category totals use splits when present
const catTotals = categoryTotals(mixed);
assert.equal(catTotals["c1"], 4000);
assert.equal(catTotals["c2"], 6000);
assert.equal(catTotals["c3"], 5000);

// Transfers flatten to no lines
transfers.forEach((tx) => {
  assert.equal(flattenSplits(tx).length, 0);
});

console.log("transactions tests passed");
