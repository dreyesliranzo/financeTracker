"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { accountSchema, type Account } from "@/types";
import { createAccount, updateAccount } from "@/lib/supabase/mutations";
import { fetchProfile } from "@/lib/supabase/queries";
import { currencyOptions } from "@/lib/money/currencies";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { successToast } from "@/lib/feedback";

const accountTypes = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" }
] as const;

const accountClasses = [
  { value: "asset", label: "Asset" },
  { value: "liability", label: "Liability" }
] as const;

export function AccountForm({
  account,
  onSuccess
}: {
  account?: Account;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });
  const accountFormSchema = accountSchema.pick({
    name: true,
    type: true,
    account_class: true,
    currency_code: true
  });
  type AccountFormValues = z.infer<typeof accountFormSchema>;
  const defaultCurrency = profile?.default_currency ?? "USD";

  const defaultValues = useMemo<AccountFormValues>(() => {
    if (!account) {
      return { name: "", type: "checking", account_class: "asset", currency_code: defaultCurrency };
    }
    const fallbackClass =
      account.account_class ?? (account.type === "credit" ? "liability" : "asset");
    return {
      name: account.name,
      type: account.type,
      account_class: fallbackClass,
      currency_code: account.currency_code ?? "USD"
    };
  }, [account, defaultCurrency]);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      if (account?.id) {
        await updateAccount(account.id, values);
        successToast("Account saved");
      } else {
        await createAccount(user.id, values);
        successToast("Account saved");
      }
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save account");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Account name</Label>
        <Input id="name" {...form.register("name")} />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select
          value={form.watch("type")}
          onValueChange={(value) =>
            form.setValue("type", value as AccountFormValues["type"])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {accountTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Class</Label>
        <Select
          value={form.watch("account_class")}
          onValueChange={(value) =>
            form.setValue("account_class", value as AccountFormValues["account_class"])
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select class" />
          </SelectTrigger>
          <SelectContent>
            {accountClasses.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Currency</Label>
        <Select
          value={form.watch("currency_code")}
          onValueChange={(value) =>
            form.setValue("currency_code", value as AccountFormValues["currency_code"])
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
      <div className="flex justify-end">
        <Button type="submit">{account ? "Save" : "Add account"}</Button>
      </div>
    </form>
  );
}
