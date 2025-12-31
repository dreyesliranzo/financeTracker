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
  type text not null,
  transaction_kind text not null default 'expense' check (transaction_kind in ('income', 'expense', 'transfer')),
  category_id uuid references categories(id) on delete set null,
  account_id uuid references accounts(id) on delete set null,
  from_account_id uuid references accounts(id) on delete set null,
  to_account_id uuid references accounts(id) on delete set null,
  currency_code text not null default 'USD',
  merchant text,
  notes text,
  tags text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table transactions
  drop constraint if exists transactions_type_check,
  add constraint transactions_type_check check (type in ('income', 'expense', 'transfer'));

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null,
  category_id uuid not null references categories(id) on delete cascade,
  limit_cents int not null,
  currency_code text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists overall_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null,
  limit_cents int not null,
  currency_code text not null default 'USD',
  created_at timestamptz not null default now(),
  unique (user_id, month, currency_code)
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

create table if not exists transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_id uuid not null references transactions(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  amount_cents int not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  priority int not null default 100,
  enabled boolean not null default true,
  allow_multiple boolean not null default false,
  conditions jsonb not null,
  actions jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  schedule_type text not null check (schedule_type in ('cron', 'rrule')),
  schedule_text text not null,
  timezone text not null default 'UTC',
  next_run_at timestamptz,
  template jsonb not null,
  created_at timestamptz not null default now(),
  last_run_at timestamptz
);

create table if not exists recurring_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references recurring_rules(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scheduled_for timestamptz not null,
  ran_at timestamptz,
  status text not null default 'pending',
  created_transaction_ids uuid[] default '{}'::uuid[]
);

create table if not exists transaction_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_id uuid not null references transactions(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists subscription_candidates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  merchant text not null,
  avg_amount_cents int not null,
  interval_guess text not null,
  next_due_date date,
  confidence numeric not null default 0,
  created_at timestamptz not null default now()
);

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

create or replace function enforce_split_total()
returns trigger as $$
declare
  tx_id uuid;
  total int;
  tx_amount int;
begin
  tx_id := coalesce(new.transaction_id, old.transaction_id);
  if tx_id is null then
    return null;
  end if;

  select amount_cents into tx_amount from transactions where id = tx_id;
  if tx_amount is null then
    return null;
  end if;

  select coalesce(sum(amount_cents), 0) into total
  from transaction_splits
  where transaction_id = tx_id;

  if total > tx_amount then
    raise exception 'Split total (%) exceeds transaction amount (%)', total, tx_amount;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists check_split_total on transaction_splits;
create trigger check_split_total
after insert or update or delete on transaction_splits
for each row execute function enforce_split_total();

create or replace function ledgerly_next_run_at(
  schedule_type text,
  schedule_text text,
  from_time timestamptz
)
returns timestamptz as $$
declare
  matches text[];
  interval_value int;
  unit text;
begin
  if schedule_text is null or schedule_text = '' then
    return from_time + interval '1 month';
  end if;

  if schedule_text = 'hourly' then
    return from_time + interval '1 hour';
  elsif schedule_text = 'daily' then
    return from_time + interval '1 day';
  elsif schedule_text = 'weekly' then
    return from_time + interval '1 week';
  elsif schedule_text = 'monthly' then
    return from_time + interval '1 month';
  elsif schedule_text = 'yearly' then
    return from_time + interval '1 year';
  elsif schedule_text ~ '^every[ ]+[0-9]+[ ]+(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)$' then
    matches := regexp_matches(schedule_text, '^every[ ]+([0-9]+)[ ]+(minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)$');
    interval_value := matches[1]::int;
    unit := matches[2];
    return from_time + (interval_value || ' ' || unit)::interval;
  end if;

  return from_time + interval '1 month';
end;
$$ language plpgsql;

create or replace function process_recurring_rules()
returns void as $$
declare
  rule record;
  run_id uuid;
  scheduled_for timestamptz;
  tx_id uuid;
  tags text[];
  split_item jsonb;
  next_time timestamptz;
  kind text;
begin
  for rule in
    select * from recurring_rules
    where enabled
      and next_run_at is not null
      and next_run_at <= now()
    order by next_run_at asc
  loop
    scheduled_for := rule.next_run_at;

    insert into recurring_runs (rule_id, user_id, scheduled_for, status)
    values (rule.id, rule.user_id, scheduled_for, 'running')
    on conflict (rule_id, scheduled_for) do nothing
    returning id into run_id;

    if run_id is null then
      continue;
    end if;

    begin
      kind := coalesce(rule.template->>'transaction_kind', rule.template->>'type', 'expense');
      if rule.template ? 'tags' then
        tags := array(select jsonb_array_elements_text(rule.template->'tags'));
      else
        tags := '{}'::text[];
      end if;

      insert into transactions (
        user_id,
        date,
        amount_cents,
        type,
        transaction_kind,
        category_id,
        account_id,
        from_account_id,
        to_account_id,
        currency_code,
        merchant,
        notes,
        tags
      )
      values (
        rule.user_id,
        coalesce((rule.template->>'date')::date, current_date),
        coalesce((rule.template->>'amount_cents')::int, 0),
        kind,
        kind,
        (rule.template->>'category_id')::uuid,
        (rule.template->>'account_id')::uuid,
        (rule.template->>'from_account_id')::uuid,
        (rule.template->>'to_account_id')::uuid,
        coalesce(rule.template->>'currency_code', 'USD'),
        rule.template->>'merchant',
        rule.template->>'notes',
        tags
      )
      returning id into tx_id;

      if rule.template ? 'splits' then
        insert into transaction_splits (user_id, transaction_id, category_id, amount_cents, note)
        select
          rule.user_id,
          tx_id,
          (split_item->>'category_id')::uuid,
          coalesce((split_item->>'amount_cents')::int, 0),
          split_item->>'note'
        from jsonb_array_elements(rule.template->'splits') as split_item;
      end if;

      update recurring_runs
      set status = 'success',
          ran_at = now(),
          created_transaction_ids = array[tx_id]
      where id = run_id;

      next_time := ledgerly_next_run_at(rule.schedule_type, rule.schedule_text, scheduled_for);
      while next_time <= now() loop
        next_time := ledgerly_next_run_at(rule.schedule_type, rule.schedule_text, next_time);
      end loop;

      update recurring_rules
      set last_run_at = now(),
          next_run_at = next_time
      where id = rule.id;
    exception
      when others then
        update recurring_runs
        set status = 'failed',
            ran_at = now()
        where id = run_id;
    end;
  end loop;
end;
$$ language plpgsql;

create or replace function ledgerly_rule_matches(
  merchant text,
  amount_cents int,
  account_id uuid,
  conditions jsonb
)
returns boolean as $$
declare
  value text;
begin
  if conditions ? 'merchant_contains' then
    value := lower(conditions->>'merchant_contains');
    if merchant is null or position(value in lower(merchant)) = 0 then
      return false;
    end if;
  end if;

  if conditions ? 'merchant_regex' then
    if merchant is null or merchant !~* (conditions->>'merchant_regex') then
      return false;
    end if;
  end if;

  if conditions ? 'min_amount' then
    if amount_cents < (conditions->>'min_amount')::int then
      return false;
    end if;
  end if;

  if conditions ? 'max_amount' then
    if amount_cents > (conditions->>'max_amount')::int then
      return false;
    end if;
  end if;

  if conditions ? 'account_id' then
    if account_id is null or account_id::text <> conditions->>'account_id' then
      return false;
    end if;
  end if;

  return true;
end;
$$ language plpgsql;

create or replace function apply_categorization_rules()
returns void as $$
declare
  tx record;
  rule record;
  matched boolean;
  action_category uuid;
  action_type text;
  new_tags text[];
begin
  for tx in
    select * from transactions
    where category_id is null
      and coalesce(transaction_kind, type) <> 'transfer'
    order by date desc
  loop
    matched := false;
    for rule in
      select * from categorization_rules
      where user_id = tx.user_id
        and enabled
      order by priority asc, created_at asc
    loop
      if matched and rule.allow_multiple = false then
        exit;
      end if;

      if ledgerly_rule_matches(tx.merchant, tx.amount_cents, tx.account_id, rule.conditions) then
        action_category := nullif(rule.actions->>'set_category_id', '')::uuid;
        action_type := nullif(rule.actions->>'set_type', '');
        new_tags := coalesce(tx.tags, '{}'::text[]);

        if rule.actions ? 'set_tags' then
          new_tags := array(
            select distinct unnest(new_tags)
            union
            select jsonb_array_elements_text(rule.actions->'set_tags')
          );
        end if;

        update transactions
        set category_id = coalesce(action_category, category_id),
            type = coalesce(action_type, type),
            transaction_kind = coalesce(action_type, transaction_kind),
            tags = new_tags
        where id = tx.id;

        matched := true;
        if rule.allow_multiple = false then
          exit;
        end if;
      end if;
    end loop;
  end loop;
end;
$$ language plpgsql;

create or replace function detect_subscription_candidates()
returns void as $$
begin
  insert into subscription_candidates (
    user_id,
    merchant,
    avg_amount_cents,
    interval_guess,
    next_due_date,
    confidence
  )
  select
    user_id,
    merchant,
    round(avg(amount_cents))::int as avg_amount_cents,
    case
      when avg_gap between 26 and 35 then 'monthly'
      when avg_gap between 6 and 8 then 'weekly'
      else 'unknown'
    end as interval_guess,
    case
      when avg_gap between 26 and 35 then (max(date) + interval '1 month')::date
      when avg_gap between 6 and 8 then (max(date) + interval '1 week')::date
      else null
    end as next_due_date,
    case
      when avg_gap between 26 and 35 then 0.85
      when avg_gap between 6 and 8 then 0.75
      else 0.4
    end as confidence
  from (
    select
      user_id,
      merchant,
      amount_cents,
      date,
      avg(extract(day from (date - lag(date) over (partition by user_id, merchant order by date))))::numeric as avg_gap
    from transactions
    where merchant is not null
      and merchant <> ''
      and coalesce(transaction_kind, type) <> 'transfer'
  ) t
  where avg_gap is not null
  group by user_id, merchant, avg_gap
  having count(*) >= 3
  on conflict (user_id, merchant)
  do update set
    avg_amount_cents = excluded.avg_amount_cents,
    interval_guess = excluded.interval_guess,
    next_due_date = excluded.next_due_date,
    confidence = excluded.confidence;
end;
$$ language plpgsql;
