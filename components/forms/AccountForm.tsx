"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { accountSchema, type Account } from "@/types";
import { createAccount, updateAccount } from "@/lib/supabase/mutations";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const accountTypes = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "other", label: "Other" }
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
  const accountFormSchema = accountSchema.pick({ name: true, type: true });
  type AccountFormValues = z.infer<typeof accountFormSchema>;

  const defaultValues = useMemo<AccountFormValues>(() => {
    if (!account) {
      return { name: "", type: "checking" };
    }
    return { name: account.name, type: account.type };
  }, [account]);

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
        toast.success("Account updated");
      } else {
        await createAccount(user.id, values);
        toast.success("Account created");
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
      <div className="flex justify-end">
        <Button type="submit">{account ? "Save" : "Add account"}</Button>
      </div>
    </form>
  );
}
