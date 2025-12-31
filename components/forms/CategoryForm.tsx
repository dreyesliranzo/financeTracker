"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { categorySchema, type Category } from "@/types";
import { createCategory, updateCategory } from "@/lib/supabase/mutations";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { successToast } from "@/lib/feedback";

export function CategoryForm({
  category,
  onSuccess
}: {
  category?: Category;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const categoryFormSchema = categorySchema.pick({ name: true, type: true, icon: true });
  type CategoryFormValues = z.infer<typeof categoryFormSchema>;

  const defaultValues = useMemo<CategoryFormValues>(() => {
    if (!category) {
      return { name: "", type: "expense", icon: "" };
    }
    return { name: category.name, type: category.type, icon: category.icon ?? "" };
  }, [category]);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user) return;
    try {
      if (category?.id) {
        await updateCategory(category.id, values);
        successToast("Category saved");
      } else {
        await createCategory(user.id, values);
        successToast("Category saved");
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      onSuccess?.();
    } catch (error) {
      console.error(error);
      toast.error("Unable to save category");
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Category name</Label>
        <Input id="name" {...form.register("name")} />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select
          value={form.watch("type")}
          onValueChange={(value) =>
            form.setValue("type", value as CategoryFormValues["type"])
          }
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
        <Label htmlFor="icon">Icon (optional)</Label>
        <Input id="icon" placeholder="Emoji or short label" {...form.register("icon")} />
      </div>
      <div className="flex justify-end">
        <Button type="submit">{category ? "Save" : "Add category"}</Button>
      </div>
    </form>
  );
}
