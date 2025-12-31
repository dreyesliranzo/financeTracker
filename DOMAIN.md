# Domain Glossary and Rules

## Definitions

- Expense: Money leaving an account. Counts toward spending totals and budgets.
- Income: Money entering an account. Counts toward income totals.
- Transfer: Money moved between two accounts. Requires `from_account_id` and `to_account_id`.
  Transfers are excluded from income, expense, and budget totals.
- Split transaction: A single transaction allocated across multiple categories.
  If splits exist, totals use split lines only (no double counting).
- Cleared: A transaction has posted and appears on the bank/card account.
- Reconciled: A cleared transaction has been matched to a statement and confirmed by the user.

## Workspace Rules (Single Source of Truth)

- Money is stored as integer cents (`amount_cents`, `limit_cents`, etc).
- `transaction_kind` is canonical when present; fallback to legacy `type`.
- Transfers never affect spending or income totals.
- Category totals use splits when present; otherwise use `category_id`.
- Splits must sum to less than or equal to the parent transaction amount.
- Multi-currency totals must be computed within a single currency; do not mix without FX.
- All per-user data is scoped to `user_id` and protected by RLS.
