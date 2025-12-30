create extension if not exists "pgcrypto";

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('checking', 'savings', 'credit', 'cash', 'investment', 'other')),
  currency_code text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  amount_cents int not null,
  type text not null check (type in ('income', 'expense')),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  currency_code text not null default 'USD',
  merchant text,
  notes text,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null,
  category_id uuid not null references categories(id) on delete cascade,
  limit_cents int not null,
  currency_code text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  full_name text,
  default_currency text not null default 'USD'
);

create table if not exists recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text,
  amount_cents int not null,
  type text not null check (type in ('income', 'expense')),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  currency_code text not null default 'USD',
  merchant text,
  notes text,
  tags text[],
  cadence text not null check (cadence in ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  start_date date not null,
  next_run date not null,
  last_run date,
  end_date date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_cents int not null,
  current_cents int not null default 0,
  currency_code text not null default 'USD',
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_transactions_updated_at
before update on transactions
for each row
execute function set_updated_at();

create trigger set_recurring_updated_at
before update on recurring_transactions
for each row
execute function set_updated_at();

create trigger set_goals_updated_at
before update on goals
for each row
execute function set_updated_at();

alter table accounts
  add column if not exists currency_code text not null default 'USD';

alter table transactions
  add column if not exists currency_code text not null default 'USD';

alter table budgets
  add column if not exists currency_code text not null default 'USD';

alter table profiles
  add column if not exists default_currency text not null default 'USD';
