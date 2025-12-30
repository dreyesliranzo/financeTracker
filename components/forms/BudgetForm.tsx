"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetFormSchema, type Budget, type BudgetFormValues } from "@/types";
import { parseCurrencyToCents } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { fetchCategories, fetchProfile } from "@/lib/supabase/queries";
import { createBudget, updateBudget } from "@/lib/supabase/mutations";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function BudgetForm({
  budget,
  onSuccess
}: {
  budget?: Budget;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });
  const defaultCurrency = profile?.default_currency ?? "USD";

  const defaultValues = useMemo<BudgetFormValues>(() => {
    if (!budget) {
      return {
        month: new Date().toISOString().slice(0, 7),
        category_id: "",
        limit: "",
        currency_code: defaultCurrency
      };
    }

    return {
      month: budget.month.slice(0, 7),
      category_id: budget.category_id,
      limit: (budget.limit_cents / 100).toFixed(2),
      currency_code: budget.currency_code ?? "USD"
    };
  }, [budget, defaultCurrency]);

  const form = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;

    const payload = {
      month: `${values.month}-01`,
      category_id: values.category_id,
      limit_cents: Math.abs(parseCurrencyToCents(values.limit)),
      currency_code: values.currency_code
    };

    try {
      if (budget?.id) {
        await updateBudget(budget.id, payload);
        toast.success("Budget updated");
      } else {
        await createBudget(user.id, payload);
        toast.success("Budget created");
      }
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save budget");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{budget ? "Edit budget" : "Create budget"}</DialogTitle>
        <DialogDescription>
          Set monthly caps for expenses by category.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <Input id="month" type="month" {...form.register("month")} />
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
              {categories
                .filter((category) => category.type === "expense")
                .map((category) => (
                  <SelectItem key={category.id!} value={category.id!}>
                    {category.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="limit">Limit</Label>
          <Input id="limit" placeholder="0.00" {...form.register("limit")} />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={form.watch("currency_code")}
            onValueChange={(value) =>
              form.setValue("currency_code", value as BudgetFormValues["currency_code"])
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
      </div>

      <div className="flex justify-end">
        <Button type="submit">{budget ? "Save budget" : "Create budget"}</Button>
      </div>
    </form>
  );
}
