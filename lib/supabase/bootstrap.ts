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

const sampleTransactions = [
  { offsetDays: 1, amount: 3200, type: "expense", category: "Food", account: "Credit Card", merchant: "Whole Foods" },
  { offsetDays: 2, amount: 8500, type: "expense", category: "Housing", account: "Checking", merchant: "Rent" },
  { offsetDays: 3, amount: 1800, type: "expense", category: "Utilities", account: "Checking", merchant: "Electric Co." },
  { offsetDays: 5, amount: 2200, type: "expense", category: "Transport", account: "Credit Card", merchant: "Uber" },
  { offsetDays: 6, amount: 5400, type: "expense", category: "Entertainment", account: "Credit Card", merchant: "AMC Theaters" },
  { offsetDays: 7, amount: 1200, type: "expense", category: "Subscriptions", account: "Credit Card", merchant: "Spotify" },
  { offsetDays: 10, amount: 52000, type: "income", category: "Salary", account: "Checking", merchant: "Acme Payroll" },
  { offsetDays: 12, amount: 4200, type: "income", category: "Side Income", account: "Checking", merchant: "Freelance" }
] as const;

const sampleBudgets = [
  { category: "Housing", limit: 120000 },
  { category: "Food", limit: 45000 },
  { category: "Transport", limit: 20000 },
  { category: "Utilities", limit: 18000 },
  { category: "Entertainment", limit: 15000 },
  { category: "Subscriptions", limit: 12000 }
] as const;

const sampleGoals = [
  { name: "Emergency fund", target: 250000, current: 50000 },
  { name: "Vacation", target: 80000, current: 12000 }
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

  const { data: transactionRows, error: transactionError } = await supabase
    .from("transactions")
    .select("id")
    .limit(1);

  const { data: accountSeedRows } = await supabase
    .from("accounts")
    .select("id,name");

  const { data: categorySeedRows } = await supabase
    .from("categories")
    .select("id,name,type");

  const accountMap = new Map(
    (accountSeedRows ?? []).map((account) => [account.name, account.id])
  );
  const categoryMap = new Map(
    (categorySeedRows ?? []).map((category) => [category.name, category.id])
  );

  if (!transactionError && (transactionRows?.length ?? 0) === 0) {
    const today = new Date();
    const payload = sampleTransactions
      .map((item) => {
        const accountId = accountMap.get(item.account);
        const categoryId = categoryMap.get(item.category);
        if (!accountId || !categoryId) return null;
        const date = new Date(today);
        date.setDate(today.getDate() - item.offsetDays);
        return {
          user_id: userId,
          date: date.toISOString().slice(0, 10),
          amount_cents: item.amount,
          type: item.type,
          category_id: categoryId,
          account_id: accountId,
          currency_code: "USD",
          merchant: item.merchant,
          notes: null,
          tags: []
        };
      })
      .filter(Boolean);

    if (payload.length > 0) {
      const { error } = await supabase.from("transactions").insert(payload);
      if (!error) didInsert = true;
    }
  }

  const { data: budgetRows, error: budgetError } = await supabase
    .from("budgets")
    .select("id")
    .limit(1);

  if (!budgetError && (budgetRows?.length ?? 0) === 0) {
    const month = new Date().toISOString().slice(0, 7) + "-01";
    const payload = sampleBudgets
      .map((item) => {
        const categoryId = categoryMap.get(item.category);
        if (!categoryId) return null;
        return {
          user_id: userId,
          month,
          category_id: categoryId,
          limit_cents: item.limit,
          currency_code: "USD"
        };
      })
      .filter(Boolean);

    if (payload.length > 0) {
      const { error } = await supabase.from("budgets").insert(payload);
      if (!error) didInsert = true;
    }
  }

  const { data: goalRows, error: goalError } = await supabase
    .from("goals")
    .select("id")
    .limit(1);

  if (!goalError && (goalRows?.length ?? 0) === 0) {
    const payload = sampleGoals.map((goal) => ({
      user_id: userId,
      name: goal.name,
      target_cents: goal.target,
      current_cents: goal.current,
      currency_code: "USD"
    }));
    const { error } = await supabase.from("goals").insert(payload);
    if (!error) didInsert = true;
  }

  const { data: overallRows, error: overallError } = await supabase
    .from("overall_budgets")
    .select("id")
    .limit(1);

  if (!overallError && (overallRows?.length ?? 0) === 0) {
    const month = new Date().toISOString().slice(0, 7) + "-01";
    const { error } = await supabase.from("overall_budgets").insert({
      user_id: userId,
      month,
      limit_cents: 220000,
      currency_code: "USD"
    });
    if (!error) didInsert = true;
  }

  return didInsert;
}
