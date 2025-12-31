"use client";

import { useEffect, useMemo } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  recurringFormSchema,
  type RecurringFormValues,
  type RecurringTransaction
} from "@/types";
import { parseCurrencyToCents } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { fetchAccounts, fetchCategories, fetchProfile } from "@/lib/supabase/queries";
import {
  createRecurringTransaction,
  updateRecurringTransaction
} from "@/lib/supabase/mutations";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { successToast } from "@/lib/feedback";

const cadenceOptions = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" }
] as const;

export function RecurringForm({
  recurring,
  onSuccess
}: {
  recurring?: RecurringTransaction;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });
  const defaultCurrency = profile?.default_currency ?? "USD";

  const defaultValues = useMemo<RecurringFormValues>(() => {
    if (!recurring) {
      return {
        name: "",
        amount: "",
        type: "expense",
        category_id: "",
        account_id: "",
        currency_code: defaultCurrency,
        cadence: "monthly",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: "",
        merchant: "",
        notes: "",
        tags: "",
        active: true
      };
    }

    return {
      name: recurring.name ?? "",
      amount: (recurring.amount_cents / 100).toFixed(2),
      type: recurring.type,
      category_id: recurring.category_id ?? "",
      account_id: recurring.account_id ?? "",
      currency_code: recurring.currency_code ?? defaultCurrency,
      cadence: recurring.cadence,
      start_date: recurring.start_date,
      end_date: recurring.end_date ?? "",
      merchant: recurring.merchant ?? "",
      notes: recurring.notes ?? "",
      tags: recurring.tags?.join(", ") ?? "",
      active: recurring.active ?? true
    };
  }, [recurring, defaultCurrency]);

  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues
  });

  const accountId = form.watch("account_id");

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    if (!accountId) return;
    const account = accounts.find((item) => item.id === accountId);
    if (!account?.currency_code) return;
    const currentCurrency = form.getValues("currency_code");
    if (currentCurrency !== account.currency_code) {
      form.setValue(
        "currency_code",
        account.currency_code as RecurringFormValues["currency_code"]
      );
    }
  }, [accountId, accounts, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;

    const payload = {
      name: values.name?.trim() || undefined,
      amount_cents: Math.abs(parseCurrencyToCents(values.amount)),
      type: values.type,
      category_id: values.category_id,
      account_id: values.account_id,
      currency_code: values.currency_code,
      cadence: values.cadence,
      start_date: values.start_date,
      next_run: recurring?.next_run ?? values.start_date,
      end_date: values.end_date?.trim() ? values.end_date : null,
      merchant: values.merchant?.trim() || null,
      notes: values.notes?.trim() || null,
      tags: values.tags
        ? values.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
      active: values.active
    };

    try {
      if (recurring?.id) {
        await updateRecurringTransaction(recurring.id, payload);
        successToast("Recurring transaction updated");
      } else {
        await createRecurringTransaction(user.id, payload);
        successToast("Recurring transaction created");
      }
      queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] });
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save recurring transaction");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>
          {recurring ? "Edit recurring transaction" : "New recurring transaction"}
        </DialogTitle>
        <DialogDescription>
          Automate entries for recurring income or expenses.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Rent, Salary, Subscriptions" {...form.register("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" placeholder="0.00" {...form.register("amount")} />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={form.watch("currency_code")}
            onValueChange={(value) =>
              form.setValue("currency_code", value as RecurringFormValues["currency_code"])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {currencyOptions.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={form.watch("type")}
            onValueChange={(value) => form.setValue("type", value as "income" | "expense")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={form.watch("category_id")}
            onValueChange={(value) => form.setValue("category_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id!} value={category.id!}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No categories yet.{" "}
              <Link href={"/settings" as Route} className="text-primary">
                Add categories in Settings.
              </Link>
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Account</Label>
          <Select
            value={form.watch("account_id")}
            onValueChange={(value) => form.setValue("account_id", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id!} value={account.id!}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {accounts.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No accounts yet.{" "}
              <Link href={"/settings" as Route} className="text-primary">
                Add accounts in Settings.
              </Link>
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Cadence</Label>
          <Select
            value={form.watch("cadence")}
            onValueChange={(value) =>
              form.setValue("cadence", value as RecurringFormValues["cadence"])
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select cadence" />
            </SelectTrigger>
            <SelectContent>
              {cadenceOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" type="date" {...form.register("start_date")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End date (optional)</Label>
          <Input id="end_date" type="date" {...form.register("end_date")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="merchant">Merchant</Label>
          <Input id="merchant" placeholder="Spotify, Payroll" {...form.register("merchant")} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" placeholder="Any notes" {...form.register("notes")} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" placeholder="subscription, fixed" {...form.register("tags")} />
        </div>
        <div className="flex items-center gap-2 md:col-span-2">
          <Checkbox
            checked={form.watch("active")}
            onCheckedChange={(value) => form.setValue("active", Boolean(value))}
          />
          <span className="text-sm text-muted-foreground">Active</span>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">
          {recurring ? "Save changes" : "Create recurring"}
        </Button>
      </div>
    </form>
  );
}
