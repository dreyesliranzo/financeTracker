import { z } from "zod";

export const accountTypeSchema = z.enum([
  "checking",
  "savings",
  "credit",
  "cash",
  "investment",
  "other"
]);
export const accountClassSchema = z.enum(["asset", "liability"]);

export const categoryTypeSchema = z.enum(["income", "expense"]);
export const transactionKindSchema = z.enum(["income", "expense", "transfer"]);
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
  account_class: accountClassSchema.default("asset"),
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
  type: transactionKindSchema,
  transaction_kind: transactionKindSchema.optional(),
  category_id: z.string().uuid().nullable(),
  account_id: z.string().uuid().nullable(),
  from_account_id: z.string().uuid().nullable().optional(),
  to_account_id: z.string().uuid().nullable().optional(),
  currency_code: currencySchema.default("USD"),
  merchant: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  transaction_splits: z
    .array(
      z.object({
        id: z.string().uuid(),
        category_id: z.string().uuid().nullable(),
        amount_cents: z.number().int(),
        note: z.string().optional().nullable()
      })
    )
    .optional()
    .nullable(),
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

export const subscriptionCandidateSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  merchant: z.string().min(1),
  avg_amount_cents: z.number().int(),
  interval_guess: z.enum(["weekly", "monthly", "unknown"]),
  next_due_date: z.string().optional().nullable(),
  confidence: z.number(),
  created_at: z.string().optional()
});

export const transactionFormSchema = z
  .object({
    date: z.string().min(1, "Date is required"),
    amount: z.string().min(1, "Amount is required"),
    type: transactionKindSchema,
    category_id: z.string().uuid().nullable().optional(),
    account_id: z.string().uuid().nullable().optional(),
    from_account_id: z.string().uuid().nullable().optional(),
    to_account_id: z.string().uuid().nullable().optional(),
    currency_code: currencySchema.default("USD"),
    merchant: z.string().optional(),
    notes: z.string().optional(),
    tags: z.string().optional(),
    splits: z
      .array(
        z.object({
          category_id: z.string().uuid({ message: "Category is required" }),
          amount: z.string().min(1, "Amount is required"),
          note: z.string().optional()
        })
      )
      .optional()
  })
  .superRefine((values, ctx) => {
    const amountValue = Number(values.amount.replace(/[^0-9.-]/g, ""));
    const splits = values.splits ?? [];
    const hasSplits = splits.length > 0;

    if (values.type === "transfer") {
      if (!values.from_account_id) {
        ctx.addIssue({ code: "custom", path: ["from_account_id"], message: "From account is required" });
      }
      if (!values.to_account_id) {
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "To account is required" });
      }
      if (values.from_account_id && values.to_account_id && values.from_account_id === values.to_account_id) {
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Accounts must differ" });
      }
      return;
    }

    if (!values.account_id) {
      ctx.addIssue({ code: "custom", path: ["account_id"], message: "Account is required" });
    }

    if (!hasSplits && !values.category_id) {
      ctx.addIssue({ code: "custom", path: ["category_id"], message: "Category is required" });
    }

    if (hasSplits) {
      const splitSum = splits.reduce((sum, split) => sum + Number(split.amount.replace(/[^0-9.-]/g, "") || 0), 0);
      if (splitSum <= 0) {
        ctx.addIssue({ code: "custom", path: ["splits"], message: "Split amounts must be greater than 0" });
      }
      if (amountValue > 0 && splitSum > amountValue + 0.0001) {
        ctx.addIssue({ code: "custom", path: ["splits"], message: "Splits exceed total amount" });
      }
    }
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
export type SubscriptionCandidate = z.infer<typeof subscriptionCandidateSchema>;
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
export type OverallBudgetFormValues = z.infer<typeof overallBudgetFormSchema>;
export type RecurringFormValues = z.infer<typeof recurringFormSchema>;
export type GoalFormValues = z.infer<typeof goalFormSchema>;
export type TransactionSplit = NonNullable<Transaction["transaction_splits"]>[number];
