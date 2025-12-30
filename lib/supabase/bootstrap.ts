import { supabaseBrowser } from "@/lib/supabase/client";

const defaultAccounts = [
  { name: "Checking", type: "checking", currency_code: "USD" },
  { name: "Savings", type: "savings", currency_code: "USD" },
  { name: "Credit Card", type: "credit", currency_code: "USD" },
  { name: "Cash", type: "cash", currency_code: "USD" }
] as const;

const defaultCategories = [
  { name: "Salary", type: "income" },
  { name: "Side Income", type: "income" },
  { name: "Housing", type: "expense" },
  { name: "Food", type: "expense" },
  { name: "Transport", type: "expense" },
  { name: "Utilities", type: "expense" },
  { name: "Entertainment", type: "expense" },
  { name: "Subscriptions", type: "expense" }
] as const;

export async function ensureDefaultData(userId: string) {
  const supabase = supabaseBrowser();
  let didInsert = false;

  const { data: accountRows, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .limit(1);

  if (!accountError && (accountRows?.length ?? 0) === 0) {
    const { error } = await supabase
      .from("accounts")
      .insert(defaultAccounts.map((item) => ({ ...item, user_id: userId })));
    if (!error) didInsert = true;
  }

  const { data: categoryRows, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .limit(1);

  if (!categoryError && (categoryRows?.length ?? 0) === 0) {
    const { error } = await supabase
      .from("categories")
      .insert(defaultCategories.map((item) => ({ ...item, user_id: userId })));
    if (!error) didInsert = true;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ user_id: userId });

  if (!profileError) {
    didInsert = true;
  }

  return didInsert;
}
