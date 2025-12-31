# Ledgerly - Personal Finance Tracker

A dark-first personal finance tracker with Supabase auth, realtime sync, and a Copilot-inspired UI.

## Tech stack
- Next.js (App Router) + TypeScript
- TailwindCSS + shadcn/ui (Radix)
- Supabase Auth + Postgres + Realtime
- TanStack Query, React Hook Form, Zod
- Recharts

## Setup

### 1) Supabase project
1. Create a new Supabase project.
2. In the SQL editor, run these files in order:
   - `supabase/schema.sql`
   - `supabase/rls.sql`
   - `supabase/indexes.sql` (optional)
3. Enable email/password auth in **Auth > Providers**.
4. Add redirect URLs in **Auth > URL Configuration**:
   - `http://localhost:3000/*`
   - `https://<your-vercel-domain>/*`

### 1b) Supabase Cron (pg_cron)
1. In the SQL editor, run:
   - `supabase/cron.sql`
2. This schedules:
   - `process_recurring_rules()` every 5 minutes
   - `apply_categorization_rules()` every 15 minutes
   - `detect_subscription_candidates()` hourly
3. Cron runs in UTC by default. If you re-run, delete existing jobs in **Database > Cron** first.

### Advanced finance primitives
- Transfers: `transactions` support `transaction_kind` (`expense` | `income` | `transfer`) plus `from_account_id` / `to_account_id` for transfers.
- Splits: `transaction_splits` store per-category amounts and notes for a parent transaction.
- Rules: `categorization_rules` hold conditions/actions for auto-tagging and categorizing.
- Recurring engine: `recurring_rules` define schedules + templates; `recurring_runs` log executions and created transaction IDs.
- Attachments: `transaction_attachments` store receipt metadata (storage path + mime type).
- All new tables have RLS enforcing `auth.uid() = user_id`; run the updated SQL in order.

### 2) Environment variables
Create a `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

For Vercel, add the same values in Project Settings > Environment Variables.

### 3) Install & run
```
npm install
npm run dev
```

## Realtime sync
The app subscribes to changes in:
- `transactions`
- `accounts`
- `categories`
- `budgets`

Subscriptions are filtered by `user_id`, and updates invalidate TanStack Query caches. The top bar displays the sync status (Connected / Reconnecting / Offline).

## CSV import template
A CSV should include at minimum:
- `date` (YYYY-MM-DD)
- `amount` (decimal, e.g. 42.50 or -42.50)

Optional columns (map them in the import wizard):
- `type` (income/expense)
- `category`
- `account`
- `merchant`
- `notes`
- `tags` (comma-separated)

Example:
```
date,amount,type,category,account,merchant,notes,tags
2025-01-03,24.50,expense,Food,Checking,Blue Bottle,Coffee,work
```

## Deploy on Vercel
1. Push the repo to GitHub.
2. Import into Vercel.
3. Add the Supabase env vars.
4. Deploy.

## Notes
- All money values are stored as integer cents (`amount_cents`, `limit_cents`).
- Row Level Security is enabled for every user table.
