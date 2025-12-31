import { supabaseBrowser } from "@/lib/supabase/client";
import type {
  Account,
  Budget,
  Category,
  Goal,
  OverallBudget,
  Profile,
  RecurringTransaction,
  Transaction
} from "@/types";

export async function createAccount(
  userId: string,
  values: Omit<Account, "id" | "user_id" | "created_at">
) {
  const { data, error } = await supabaseBrowser()
    .from("accounts")
    .insert({ ...values, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as Account;
}

export async function updateAccount(
  id: string,
  values: Partial<Omit<Account, "id" | "user_id" | "created_at">>
) {
  const { data, error } = await supabaseBrowser()
    .from("accounts")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Account;
}

export async function deleteAccount(id: string) {
  const { error } = await supabaseBrowser().from("accounts").delete().eq("id", id);
  if (error) throw error;
}

export async function createCategory(
  userId: string,
  values: Omit<Category, "id" | "user_id" | "created_at">
) {
  const { data, error } = await supabaseBrowser()
    .from("categories")
    .insert({ ...values, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as Category;
}

export async function updateCategory(
  id: string,
  values: Partial<Omit<Category, "id" | "user_id" | "created_at">>
) {
  const { data, error } = await supabaseBrowser()
    .from("categories")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string) {
  const { error } = await supabaseBrowser().from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function createTransaction(
  userId: string,
  values: Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at">
) {
  const { data, error } = await supabaseBrowser()
    .from("transactions")
    .insert({ ...values, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as Transaction;
}

export async function updateTransaction(
  id: string,
  values: Partial<Omit<Transaction, "id" | "user_id" | "created_at" | "updated_at">>
) {
  const { data, error } = await supabaseBrowser()
    .from("transactions")
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Transaction;
}

export async function deleteTransaction(id: string) {
  const { error } = await supabaseBrowser()
    .from("transactions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function bulkDeleteTransactions(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabaseBrowser()
    .from("transactions")
    .delete()
    .in("id", ids);
  if (error) throw error;
}

export async function createBudget(
  userId: string,
  values: Omit<Budget, "id" | "user_id" | "created_at">
) {
  const { data, error } = await supabaseBrowser()
    .from("budgets")
    .insert({ ...values, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as Budget;
}

export async function updateBudget(
  id: string,
  values: Partial<Omit<Budget, "id" | "user_id" | "created_at">>
) {
  const { data, error } = await supabaseBrowser()
    .from("budgets")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Budget;
}

export async function deleteBudget(id: string) {
  const { error } = await supabaseBrowser().from("budgets").delete().eq("id", id);
  if (error) throw error;
}

export async function createOverallBudget(
  userId: string,
  values: Omit<OverallBudget, "id" | "user_id" | "created_at">
) {
  const { data, error } = await supabaseBrowser()
    .from("overall_budgets")
    .insert({ ...values, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as OverallBudget;
}

export async function updateOverallBudget(
  id: string,
  values: Partial<Omit<OverallBudget, "id" | "user_id" | "created_at">>
) {
  const { data, error } = await supabaseBrowser()
    .from("overall_budgets")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as OverallBudget;
}

export async function deleteOverallBudget(id: string) {
  const { error } = await supabaseBrowser()
    .from("overall_budgets")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createRecurringTransaction(
  userId: string,
  values: Omit<RecurringTransaction, "id" | "user_id" | "created_at" | "updated_at">
) {
  const { data, error } = await supabaseBrowser()
    .from("recurring_transactions")
    .insert({ ...values, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as RecurringTransaction;
}

export async function updateRecurringTransaction(
  id: string,
  values: Partial<Omit<RecurringTransaction, "id" | "user_id" | "created_at" | "updated_at">>
) {
  const { data, error } = await supabaseBrowser()
    .from("recurring_transactions")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as RecurringTransaction;
}

export async function deleteRecurringTransaction(id: string) {
  const { error } = await supabaseBrowser()
    .from("recurring_transactions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function createGoal(
  userId: string,
  values: Omit<Goal, "id" | "user_id" | "created_at" | "updated_at">
) {
  const { data, error } = await supabaseBrowser()
    .from("goals")
    .insert({ ...values, user_id: userId })
    .select("*")
    .single();

  if (error) throw error;
  return data as Goal;
}

export async function updateGoal(
  id: string,
  values: Partial<Omit<Goal, "id" | "user_id" | "created_at" | "updated_at">>
) {
  const { data, error } = await supabaseBrowser()
    .from("goals")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as Goal;
}

export async function deleteGoal(id: string) {
  const { error } = await supabaseBrowser().from("goals").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertProfile(
  values: Partial<Omit<Profile, "user_id">> & Pick<Profile, "user_id">
) {
  const { data, error } = await supabaseBrowser()
    .from("profiles")
    .upsert(values)
    .select("*")
    .single();

  if (error) throw error;
  return data as Profile;
}
