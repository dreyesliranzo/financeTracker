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

export const accountSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
  name: z.string().min(1, "Account name is required"),
  type: accountTypeSchema,
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
  created_at: z.string().optional()
});

export const profileSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().optional(),
  default_currency: z.string().default("USD")
});

export const transactionFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.string().min(1, "Amount is required"),
  type: categoryTypeSchema,
  category_id: z.string().uuid({ message: "Category is required" }),
  account_id: z.string().uuid({ message: "Account is required" }),
  merchant: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional()
});

export const budgetFormSchema = z.object({
  month: z.string().min(1, "Month is required"),
  category_id: z.string().uuid({ message: "Category is required" }),
  limit: z.string().min(1, "Limit is required")
});

export type Account = z.infer<typeof accountSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type Profile = z.infer<typeof profileSchema>;
export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
export type BudgetFormValues = z.infer<typeof budgetFormSchema>;
