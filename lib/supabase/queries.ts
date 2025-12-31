import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  Account,
  Budget,
  Category,
  Goal,
  OverallBudget,
  Profile,
  RecurringTransaction,
  SubscriptionCandidate,
  Transaction
} from "@/types";

type DateRange = {
  start?: string;
  end?: string;
};

type TransactionFilters = {
  type?: "income" | "expense" | "transfer";
  categoryId?: string;
  accountId?: string;
  currencyCode?: string;
  search?: string;
};

type TransactionSummary = Transaction & {
  transaction_splits?: {
    id: string;
    category_id: string | null;
    amount_cents: number;
    note?: string | null;
  }[];
};

export async function fetchAccounts() {
  const { data, error } = await supabaseBrowser()
    .from("accounts")
    .select("id,name,type,account_class,currency_code,created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function fetchCategories() {
  const { data, error } = await supabaseBrowser()
    .from("categories")
    .select("id,name,type,icon,created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchTransactions(range?: DateRange, currencyCode?: string) {
  let query = supabaseBrowser()
    .from("transactions")
    .select("*, transaction_splits(id,category_id,amount_cents,note)")
    .order("date", { ascending: false });

  if (range?.start) {
    query = query.gte("date", range.start);
  }

  if (range?.end) {
    query = query.lte("date", range.end);
  }

  if (currencyCode) {
    query = query.eq("currency_code", currencyCode);
  }

  const { data, error } = await query.returns<TransactionSummary[]>();
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function fetchTransactionsSummary(
  range?: DateRange,
  currencyCode?: string,
  options?: {
    includeSplits?: boolean;
    limit?: number;
  }
) {
  const includeSplits = options?.includeSplits ?? true;
  const fields = includeSplits
    ? ("id,date,amount_cents,type,transaction_kind,category_id,account_id,from_account_id,to_account_id,currency_code,merchant,transaction_splits(id,category_id,amount_cents,note)" as const)
    : ("id,date,amount_cents,type,transaction_kind,category_id,account_id,from_account_id,to_account_id,currency_code,merchant" as const);

  let query = supabaseBrowser()
    .from("transactions")
    .select(fields)
    .order("date", { ascending: false });

  if (range?.start) {
    query = query.gte("date", range.start);
  }

  if (range?.end) {
    query = query.lte("date", range.end);
  }

  if (currencyCode) {
    query = query.eq("currency_code", currencyCode);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query.returns<TransactionSummary[]>();
  if (error) throw error;
  return (data ?? []) as TransactionSummary[];
}

export async function fetchTransactionsPage(
  options: {
    range?: DateRange;
    filters?: TransactionFilters;
    page: number;
    pageSize: number;
    sortKey?: "date" | "amount";
  }
) {
  const { range, filters, page, pageSize, sortKey = "date" } = options;
  const orderKey = sortKey === "amount" ? "amount_cents" : "date";
  let query = supabaseBrowser()
    .from("transactions")
    .select(
      "id,date,amount_cents,type,transaction_kind,category_id,account_id,from_account_id,to_account_id,currency_code,merchant,transaction_splits(id,category_id,amount_cents,note)",
      { count: "exact" }
    )
    .order(orderKey, { ascending: false });

  if (range?.start) {
    query = query.gte("date", range.start);
  }

  if (range?.end) {
    query = query.lte("date", range.end);
  }

  if (filters?.currencyCode) {
    query = query.eq("currency_code", filters.currencyCode);
  }

  if (filters?.type) {
    query = query.eq("type", filters.type);
  }

  if (filters?.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  if (filters?.accountId) {
    query = query.eq("account_id", filters.accountId);
  }

  if (filters?.search && filters.search.trim().length > 0) {
    const value = filters.search.trim().replace(/%/g, "");
    query = query.or(`merchant.ilike.%${value}%,notes.ilike.%${value}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) throw error;
  return {
    data: (data ?? []) as Transaction[],
    count: count ?? 0
  };
}

export async function fetchBudgets(month?: string, currencyCode?: string) {
  let query = supabaseBrowser()
    .from("budgets")
    .select("id,month,category_id,limit_cents,currency_code,created_at")
    .order("created_at", { ascending: true });

  if (month) {
    query = query.eq("month", month);
  }

  if (currencyCode) {
    query = query.eq("currency_code", currencyCode);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Budget[];
}

export async function fetchOverallBudgets(month?: string, currencyCode?: string) {
  let query = supabaseBrowser()
    .from("overall_budgets")
    .select("id,month,limit_cents,currency_code,created_at")
    .order("created_at", { ascending: true });

  if (month) {
    query = query.eq("month", month);
  }

  if (currencyCode) {
    query = query.eq("currency_code", currencyCode);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OverallBudget[];
}

export async function fetchRecurringTransactions() {
  const { data, error } = await supabaseBrowser()
    .from("recurring_transactions")
    .select(
      "id,name,amount_cents,type,category_id,account_id,currency_code,merchant,notes,tags,cadence,start_date,next_run,last_run,end_date,active,created_at,updated_at"
    )
    .order("next_run", { ascending: true });

  if (error) throw error;
  return (data ?? []) as RecurringTransaction[];
}

export async function fetchGoals(currencyCode?: string) {
  let query = supabaseBrowser()
    .from("goals")
    .select("id,name,target_cents,current_cents,currency_code,due_date,created_at,updated_at")
    .order("created_at", { ascending: true });

  if (currencyCode) {
    query = query.eq("currency_code", currencyCode);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Goal[];
}

export async function fetchProfile() {
  const { data, error } = await supabaseBrowser()
    .from("profiles")
    .select("*")
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return (data ?? null) as Profile | null;
}

export async function fetchSubscriptionCandidates() {
  const { data, error } = await supabaseBrowser()
    .from("subscription_candidates")
    .select("id,merchant,avg_amount_cents,interval_guess,next_due_date,confidence,created_at")
    .order("confidence", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SubscriptionCandidate[];
}
