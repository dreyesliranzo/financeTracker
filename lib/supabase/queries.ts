import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  Account,
  Budget,
  Category,
  Goal,
  Profile,
  RecurringTransaction,
  Transaction
} from "@/types";

type DateRange = {
  start?: string;
  end?: string;
};

type TransactionFilters = {
  type?: "income" | "expense";
  categoryId?: string;
  accountId?: string;
  currencyCode?: string;
  search?: string;
};

export async function fetchAccounts() {
  const { data, error } = await supabaseBrowser()
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Account[];
}

export async function fetchCategories() {
  const { data, error } = await supabaseBrowser()
    .from("categories")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function fetchTransactions(range?: DateRange, currencyCode?: string) {
  let query = supabaseBrowser()
    .from("transactions")
    .select("*")
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

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function fetchTransactionsPage(
  options: {
    range?: DateRange;
    filters?: TransactionFilters;
    page: number;
    pageSize: number;
  }
) {
  const { range, filters, page, pageSize } = options;
  let query = supabaseBrowser()
    .from("transactions")
    .select("*", { count: "exact" })
    .order("date", { ascending: false });

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
    .select("*")
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

export async function fetchRecurringTransactions() {
  const { data, error } = await supabaseBrowser()
    .from("recurring_transactions")
    .select("*")
    .order("next_run", { ascending: true });

  if (error) throw error;
  return (data ?? []) as RecurringTransaction[];
}

export async function fetchGoals(currencyCode?: string) {
  let query = supabaseBrowser()
    .from("goals")
    .select("*")
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
