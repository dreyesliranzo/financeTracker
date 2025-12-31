"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  overallBudgetFormSchema,
  type OverallBudget,
  type OverallBudgetFormValues
} from "@/types";
import { parseCurrencyToCents } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { fetchProfile } from "@/lib/supabase/queries";
import { createOverallBudget, updateOverallBudget } from "@/lib/supabase/mutations";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function OverallBudgetForm({
  budget,
  onSuccess
}: {
  budget?: OverallBudget | null;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });
  const defaultCurrency = profile?.default_currency ?? "USD";

  const defaultValues = useMemo<OverallBudgetFormValues>(() => {
    if (!budget) {
      return {
        month: new Date().toISOString().slice(0, 7),
        limit: "",
        currency_code: defaultCurrency
      };
    }

    return {
      month: budget.month.slice(0, 7),
      limit: (budget.limit_cents / 100).toFixed(2),
      currency_code: budget.currency_code ?? "USD"
    };
  }, [budget, defaultCurrency]);

  const form = useForm<OverallBudgetFormValues>({
    resolver: zodResolver(overallBudgetFormSchema),
    defaultValues
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;

    const payload = {
      month: `${values.month}-01`,
      limit_cents: Math.abs(parseCurrencyToCents(values.limit)),
      currency_code: values.currency_code
    };

    try {
      if (budget?.id) {
        await updateOverallBudget(budget.id, payload);
        toast.success("General budget updated");
      } else {
        await createOverallBudget(user.id, payload);
        toast.success("General budget created");
      }
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save general budget");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{budget ? "Edit general budget" : "Create general budget"}</DialogTitle>
        <DialogDescription>
          Track a single monthly spending cap across categories.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="month">Month</Label>
          <Input id="month" type="month" {...form.register("month")} />
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
              form.setValue(
                "currency_code",
                value as OverallBudgetFormValues["currency_code"]
              )
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
        <Button type="submit">
          {budget ? "Save budget" : "Create general budget"}
        </Button>
      </div>
    </form>
  );
}
