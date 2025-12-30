import { supabaseBrowser } from "@/lib/supabase/client";
import type { Account, Budget, Category, Transaction } from "@/types";

type DateRange = {
  start?: string;
  end?: string;
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

export async function fetchTransactions(range?: DateRange) {
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

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function fetchBudgets(month?: string) {
  let query = supabaseBrowser()
    .from("budgets")
    .select("*")
    .order("created_at", { ascending: true });

  if (month) {
    query = query.eq("month", month);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Budget[];
}
