# Schema Migration Workflow

Use this checklist to apply Supabase schema changes safely.

## 1) Plan the change

- Define the goal and the data impact.
- Prefer additive changes (new columns/tables) over destructive changes.
- Update `types/schemas.ts` and `lib/CALC_ENGINE.ts` in the same PR.

## 2) Prepare SQL

- Use `create table if not exists` for new tables.
- Use `alter table ... add column if not exists` for new columns.
- Use `drop trigger if exists` before creating triggers.
- Add indexes for new query patterns.
- Enable RLS and add policies for any new tables.

## 3) Apply in Supabase SQL Editor

1. Run schema changes.
2. Run RLS policies.
3. Run indexes (optional but recommended).

If you need data backfills, run them after schema changes and before deploying
code that depends on the new data.

## 4) Deploy code in phases

- Phase A: Deploy code that can read both old and new fields.
- Phase B: Backfill data and verify.
- Phase C: Switch code to rely on new fields.
- Phase D: Remove legacy fields only after verification.

## 5) Verify

- Confirm RLS and policies with a non-owner user.
- Run `npm run build` locally and in preview.
- Validate totals via `lib/CALC_ENGINE.ts`.

## 6) Rollback strategy

- Keep old columns until the new ones are proven.
- Avoid destructive operations without a backup.
