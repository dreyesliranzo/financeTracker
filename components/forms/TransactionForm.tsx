"use client";

import { useEffect, useMemo } from "react";
import type { Route } from "next";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  transactionFormSchema,
  type Transaction,
  type TransactionFormValues
} from "@/types";
import { parseCurrencyToCents } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { fetchAccounts, fetchCategories, fetchProfile } from "@/lib/supabase/queries";
import {
  createTransaction,
  updateTransaction
} from "@/lib/supabase/mutations";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { showSuccessToast } from "@/lib/toast";

export function TransactionForm({
  transaction,
  onSuccess
}: {
  transaction?: Transaction;
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

  const defaultValues = useMemo<TransactionFormValues>(() => {
    if (!transaction) {
      return {
        date: new Date().toISOString().slice(0, 10),
        amount: "",
        type: "expense",
        category_id: "",
        account_id: "",
        currency_code: defaultCurrency,
        merchant: "",
        notes: "",
        tags: ""
      };
    }

    return {
      date: transaction.date,
      amount: (transaction.amount_cents / 100).toFixed(2),
      type: transaction.type,
      category_id: transaction.category_id ?? "",
      account_id: transaction.account_id ?? "",
      currency_code: transaction.currency_code ?? "USD",
      merchant: transaction.merchant ?? "",
      notes: transaction.notes ?? "",
      tags: transaction.tags?.join(", ") ?? ""
    };
  }, [transaction, defaultCurrency]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
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
        account.currency_code as TransactionFormValues["currency_code"]
      );
    }
  }, [accountId, accounts, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;

    const payload = {
      date: values.date,
      amount_cents: Math.abs(parseCurrencyToCents(values.amount)),
      type: values.type,
      category_id: values.category_id || null,
      account_id: values.account_id || null,
      currency_code: values.currency_code,
      merchant: values.merchant?.trim() || null,
      notes: values.notes?.trim() || null,
      tags: values.tags
        ? values.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : []
    };

    try {
      if (transaction?.id) {
        await updateTransaction(transaction.id, payload);
        showSuccessToast("Transaction updated");
      } else {
        await createTransaction(user.id, payload);
        showSuccessToast("Transaction added");
      }
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      form.reset(defaultValues);
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save transaction");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>
          {transaction ? "Edit transaction" : "Add transaction"}
        </DialogTitle>
        <DialogDescription>
          Capture the details for accurate cashflow tracking.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...form.register("date")} />
          {form.formState.errors.date ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.date.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            placeholder="0.00"
            {...form.register("amount")}
          />
          {form.formState.errors.amount ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.amount.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={form.watch("currency_code")}
            onValueChange={(value) =>
              form.setValue("currency_code", value as TransactionFormValues["currency_code"])
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
          {form.formState.errors.category_id ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.category_id.message}
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
          {form.formState.errors.account_id ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.account_id.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="merchant">Merchant</Label>
          <Input id="merchant" placeholder="Coffee shop" {...form.register("merchant")} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" placeholder="Add a note" {...form.register("notes")} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" placeholder="work, travel" {...form.register("tags")} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit">{transaction ? "Save changes" : "Add transaction"}</Button>
      </div>
    </form>
  );
}
