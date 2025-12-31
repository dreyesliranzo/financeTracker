import { z } from "zod";

export const accountTypeSchema = z.enum([
  "checking",
  "savings",
  "credit",
  "cash",
  "investment",
  "other"
]);

export const categoryTypeSchema = z.enum(["income", "expense"]);
export const currencySchema = z.enum([
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "MXN",
  "JPY",
  "AUD"
]);

export const cadenceSchema = z.enum([
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly"
]);

export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  name: z.string().min(1, "Account name is required"),
  type: accountTypeSchema,
  currency_code: currencySchema.default("USD"),
  created_at: z.string().optional()
});

export const categorySchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  name: z.string().min(1, "Category name is required"),
  type: categoryTypeSchema,
  icon: z.string().optional().nullable(),
  created_at: z.string().optional()
});

export const transactionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  date: z.string().min(1, "Date is required"),
  amount_cents: z.number().int(),
  type: categoryTypeSchema,
  category_id: z.string().uuid().nullable(),
  account_id: z.string().uuid().nullable(),
  currency_code: currencySchema.default("USD"),
  merchant: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const budgetSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  month: z.string().min(1, "Month is required"),
  category_id: z.string().uuid(),
  limit_cents: z.number().int(),
  currency_code: currencySchema.default("USD"),
  created_at: z.string().optional()
});

export const overallBudgetSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  month: z.string().min(1, "Month is required"),
  limit_cents: z.number().int(),
  currency_code: currencySchema.default("USD"),
  created_at: z.string().optional()
});

export const profileSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().optional(),
  default_currency: currencySchema.default("USD")
});

export const recurringTransactionSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  name: z.string().optional(),
  amount_cents: z.number().int(),
  type: categoryTypeSchema,
  category_id: z.string().uuid().nullable(),
  account_id: z.string().uuid().nullable(),
  currency_code: currencySchema.default("USD"),
  merchant: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  cadence: cadenceSchema,
  start_date: z.string().min(1, "Start date is required"),
  next_run: z.string().min(1, "Next run date is required"),
  last_run: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  active: z.boolean().default(true),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const goalSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  name: z.string().min(1, "Goal name is required"),
  target_cents: z.number().int(),
  current_cents: z.number().int().default(0),
  currency_code: currencySchema.default("USD"),
  due_date: z.string().optional().nullable(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

export const transactionFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.string().min(1, "Amount is required"),
  type: categoryTypeSchema,
  category_id: z.string().uuid({ message: "Category is required" }),
  account_id: z.string().uuid({ message: "Account is required" }),
  currency_code: currencySchema.default("USD"),
  merchant: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional()
});

export const budgetFormSchema = z.object({
  month: z.string().min(1, "Month is required"),
  category_id: z.string().uuid({ message: "Category is required" }),
  limit: z.string().min(1, "Limit is required"),
  currency_code: currencySchema.default("USD")
});

export const overallBudgetFormSchema = z.object({
  month: z.string().min(1, "Month is required"),
  limit: z.string().min(1, "Limit is required"),
  currency_code: currencySchema.default("USD")
});

export const recurringFormSchema = z.object({
  name: z.string().optional(),
  amount: z.string().min(1, "Amount is required"),
  type: categoryTypeSchema,
  category_id: z.string().uuid({ message: "Category is required" }),
  account_id: z.string().uuid({ message: "Account is required" }),
  currency_code: currencySchema.default("USD"),
  cadence: cadenceSchema,
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional(),
  merchant: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
  active: z.boolean().default(true)
});

export const goalFormSchema = z.object({
  name: z.string().min(1, "Goal name is required"),
  target: z.string().min(1, "Target is required"),
  current: z.string().optional(),
  currency_code: currencySchema.default("USD"),
  due_date: z.string().optional()
});

export type Account = z.infer<typeof accountSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type OverallBudget = z.infer<typeof overallBudgetSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type RecurringTransaction = z.infer<typeof recurringTransactionSchema>;
export type Goal = z.infer<typeof goalSchema>;
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
export type OverallBudgetFormValues = z.infer<typeof overallBudgetFormSchema>;
export type RecurringFormValues = z.infer<typeof recurringFormSchema>;
export type GoalFormValues = z.infer<typeof goalFormSchema>;
