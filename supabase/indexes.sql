create index if not exists accounts_user_id_idx on accounts(user_id);
create index if not exists categories_user_id_idx on categories(user_id);
create index if not exists transactions_user_id_idx on transactions(user_id);
create index if not exists transactions_user_id_date_idx on transactions(user_id, date);
create index if not exists budgets_user_id_month_idx on budgets(user_id, month);
