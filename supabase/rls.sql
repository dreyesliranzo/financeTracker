alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table overall_budgets enable row level security;
alter table profiles enable row level security;
alter table recurring_transactions enable row level security;
alter table goals enable row level security;

create policy "Accounts are viewable by owner" on accounts
  for select using (auth.uid() = user_id);
create policy "Accounts insert by owner" on accounts
  for insert with check (auth.uid() = user_id);
create policy "Accounts update by owner" on accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Accounts delete by owner" on accounts
  for delete using (auth.uid() = user_id);

create policy "Categories viewable by owner" on categories
  for select using (auth.uid() = user_id);
create policy "Categories insert by owner" on categories
  for insert with check (auth.uid() = user_id);
create policy "Categories update by owner" on categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Categories delete by owner" on categories
  for delete using (auth.uid() = user_id);

create policy "Transactions viewable by owner" on transactions
  for select using (auth.uid() = user_id);
create policy "Transactions insert by owner" on transactions
  for insert with check (auth.uid() = user_id);
create policy "Transactions update by owner" on transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Transactions delete by owner" on transactions
  for delete using (auth.uid() = user_id);

create policy "Budgets viewable by owner" on budgets
  for select using (auth.uid() = user_id);
create policy "Budgets insert by owner" on budgets
  for insert with check (auth.uid() = user_id);
create policy "Budgets update by owner" on budgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Budgets delete by owner" on budgets
  for delete using (auth.uid() = user_id);

create policy "Overall budgets viewable by owner" on overall_budgets
  for select using (auth.uid() = user_id);
create policy "Overall budgets insert by owner" on overall_budgets
  for insert with check (auth.uid() = user_id);
create policy "Overall budgets update by owner" on overall_budgets
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Overall budgets delete by owner" on overall_budgets
  for delete using (auth.uid() = user_id);

create policy "Profiles viewable by owner" on profiles
  for select using (auth.uid() = user_id);
create policy "Profiles insert by owner" on profiles
  for insert with check (auth.uid() = user_id);
create policy "Profiles update by owner" on profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Profiles delete by owner" on profiles
  for delete using (auth.uid() = user_id);

create policy "Recurring viewable by owner" on recurring_transactions
  for select using (auth.uid() = user_id);
create policy "Recurring insert by owner" on recurring_transactions
  for insert with check (auth.uid() = user_id);
create policy "Recurring update by owner" on recurring_transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Recurring delete by owner" on recurring_transactions
  for delete using (auth.uid() = user_id);

create policy "Goals viewable by owner" on goals
  for select using (auth.uid() = user_id);
create policy "Goals insert by owner" on goals
  for insert with check (auth.uid() = user_id);
create policy "Goals update by owner" on goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Goals delete by owner" on goals
  for delete using (auth.uid() = user_id);
