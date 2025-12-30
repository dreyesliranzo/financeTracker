"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { goalFormSchema, type Goal, type GoalFormValues } from "@/types";
import { parseCurrencyToCents } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { fetchProfile } from "@/lib/supabase/queries";
import { createGoal, updateGoal } from "@/lib/supabase/mutations";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function GoalForm({
  goal,
  onSuccess
}: {
  goal?: Goal;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });
  const defaultCurrency = profile?.default_currency ?? "USD";

  const defaultValues = useMemo<GoalFormValues>(() => {
    if (!goal) {
      return {
        name: "",
        target: "",
        current: "",
        currency_code: defaultCurrency,
        due_date: ""
      };
    }

    return {
      name: goal.name,
      target: (goal.target_cents / 100).toFixed(2),
      current: goal.current_cents ? (goal.current_cents / 100).toFixed(2) : "",
      currency_code: goal.currency_code ?? defaultCurrency,
      due_date: goal.due_date ?? ""
    };
  }, [goal, defaultCurrency]);

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;

    const payload = {
      name: values.name.trim(),
      target_cents: Math.abs(parseCurrencyToCents(values.target)),
      current_cents: Math.abs(parseCurrencyToCents(values.current || "0")),
      currency_code: values.currency_code,
      due_date: values.due_date?.trim() ? values.due_date : null
    };

    try {
      if (goal?.id) {
        await updateGoal(goal.id, payload);
        toast.success("Goal updated");
      } else {
        await createGoal(user.id, payload);
        toast.success("Goal created");
      }
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save goal");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <DialogHeader>
        <DialogTitle>{goal ? "Edit goal" : "Create goal"}</DialogTitle>
        <DialogDescription>
          Track progress toward savings or payoff targets.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="name">Goal name</Label>
          <Input id="name" placeholder="Emergency fund" {...form.register("name")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="target">Target</Label>
          <Input id="target" placeholder="0.00" {...form.register("target")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="current">Current (optional)</Label>
          <Input id="current" placeholder="0.00" {...form.register("current")} />
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select
            value={form.watch("currency_code")}
            onValueChange={(value) =>
              form.setValue("currency_code", value as GoalFormValues["currency_code"])
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
          <Label htmlFor="due_date">Due date (optional)</Label>
          <Input id="due_date" type="date" {...form.register("due_date")} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit">{goal ? "Save goal" : "Create goal"}</Button>
      </div>
    </form>
  );
}
