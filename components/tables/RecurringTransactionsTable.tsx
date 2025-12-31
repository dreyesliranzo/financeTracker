"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatSignedCurrency } from "@/lib/money";
import { fetchAccounts, fetchCategories, fetchRecurringTransactions } from "@/lib/supabase/queries";
import { createTransaction, createRecurringTransaction, deleteRecurringTransaction, updateRecurringTransaction } from "@/lib/supabase/mutations";
import type { RecurringTransaction } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecurringForm } from "@/components/forms/RecurringForm";
import { EmptyState } from "@/components/empty/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/AuthProvider";
import { formatDate, getNextRunDate } from "@/lib/supabase/recurring";
import { successToast } from "@/lib/feedback";

export function RecurringTransactionsTable() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);

  const { data: recurring = [], isLoading } = useQuery({
    queryKey: ["recurring_transactions"],
    queryFn: fetchRecurringTransactions
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts
  });

  const categoryMap = useMemo(() => {
    return new Map(
      categories
        .filter((category) => Boolean(category.id))
        .map((category) => [category.id!, category.name])
    );
  }, [categories]);

  const accountMap = useMemo(() => {
    return new Map(
      accounts
        .filter((account) => Boolean(account.id))
        .map((account) => [account.id!, account.name])
    );
  }, [accounts]);

  const skeletonRows = useMemo(() => Array.from({ length: 5 }, (_, index) => index), []);

  const summary = useMemo(() => {
    const active = recurring.filter((item) => item.active);
    const nextWeek = active.filter((item) => {
      if (!item.next_run) return false;
      const next = new Date(item.next_run);
      const today = new Date();
      const delta = next.getTime() - today.getTime();
      return delta >= 0 && delta <= 7 * 24 * 60 * 60 * 1000;
    });
    return {
      activeCount: active.length,
      pausedCount: recurring.length - active.length,
      dueSoon: nextWeek.length
    };
  }, [recurring]);

  const handleToggleActive = async (item: RecurringTransaction) => {
    try {
      await updateRecurringTransaction(item.id!, { active: !item.active });
      queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] });
      successToast(item.active ? "Recurring paused" : "Recurring resumed");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update recurring transaction");
    }
  };

  const handleRunNow = async (item: RecurringTransaction) => {
    if (!user) return;
    try {
      const today = formatDate(new Date());
      await createTransaction(user.id, {
        date: today,
        amount_cents: item.amount_cents,
        type: item.type,
        category_id: item.category_id ?? null,
        account_id: item.account_id ?? null,
        currency_code: item.currency_code ?? "USD",
        merchant: item.merchant ?? null,
        notes: item.notes ?? null,
        tags: item.tags ?? []
      });
      const nextRun = getNextRunDate(item.next_run, item.cadence);
      await updateRecurringTransaction(item.id!, {
        last_run: today,
        next_run: nextRun
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["recurring_transactions"], exact: false });
      successToast("Recurring transaction created");
    } catch (error) {
      console.error(error);
      toast.error("Unable to run recurring transaction");
    }
  };

  const handleSkipNext = async (item: RecurringTransaction) => {
    try {
      const nextRun = getNextRunDate(item.next_run, item.cadence);
      await updateRecurringTransaction(item.id!, { next_run: nextRun });
      queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] });
      successToast("Next occurrence skipped");
    } catch (error) {
      console.error(error);
      toast.error("Unable to skip occurrence");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecurringTransaction(id);
      queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] });
      successToast("Recurring transaction deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete recurring transaction");
    }
  };

  const templates: Array<{ name: string; cadence: RecurringTransaction["cadence"]; type: "income" | "expense"; amount_cents: number; merchant?: string }> = [
    { name: "Rent", cadence: "monthly", type: "expense", amount_cents: 150000, merchant: "Landlord" },
    { name: "Payroll", cadence: "biweekly", type: "income", amount_cents: 250000, merchant: "Employer" },
    { name: "Subscriptions", cadence: "monthly", type: "expense", amount_cents: 3000, merchant: "Subscriptions" }
  ];

  const handleTemplateCreate = async (templateName: string) => {
    if (!user) return;
    const template = templates.find((item) => item.name === templateName);
    if (!template) return;
    const accountId = accounts[0]?.id;
    const categoryId = categories.find((cat) =>
      template.type === "income" ? cat.type === "income" : cat.type === "expense"
    )?.id;
    if (!accountId || !categoryId) {
      toast.error("Add at least one account and category first.");
      return;
    }
    try {
      await createRecurringTransaction(user.id, {
        name: template.name,
        amount_cents: template.amount_cents,
        type: template.type,
        category_id: categoryId,
        account_id: accountId,
        currency_code: "USD",
        merchant: template.merchant ?? template.name,
        notes: null,
        tags: [],
        cadence: template.cadence,
        start_date: formatDate(new Date()),
        next_run: formatDate(new Date()),
        end_date: null,
        last_run: null,
        active: true
      });
      queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] });
      successToast(`${template.name} created`);
    } catch (error) {
      console.error(error);
      toast.error("Unable to create from template");
    }
  };

  if (!isLoading && recurring.length === 0) {
    return (
      <EmptyState
        title="No recurring transactions"
        description="Create schedules for rent, payroll, or subscriptions."
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button>New recurring</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <RecurringForm />
            </DialogContent>
          </Dialog>
        }
        secondaryAction={
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <Button key={template.name} variant="outline" onClick={() => handleTemplateCreate(template.name)}>
                Use {template.name}
              </Button>
            ))}
          </div>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Automate repeating entries and keep schedules in sync.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>New recurring</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <RecurringForm />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Due soon</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.dueSoon}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Paused</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{summary.pausedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Cadence</TableHead>
              <TableHead>Next run</TableHead>
              <TableHead>Last run</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? skeletonRows.map((row) => (
                  <TableRow key={`recurring-skeleton-${row}`}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-8 w-12" />
                        <Skeleton className="h-8 w-12" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              : recurring.map((item) => {
                  const accountName = item.account_id
                    ? accountMap.get(item.account_id)
                    : undefined;
                  const categoryName = item.category_id
                    ? categoryMap.get(item.category_id)
                    : undefined;
                  const title =
                    item.name ||
                    item.merchant ||
                    categoryName ||
                    (item.type === "income" ? "Income" : "Expense");
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{title}</TableCell>
                      <TableCell className="capitalize">{item.cadence}</TableCell>
                      <TableCell>{item.next_run}</TableCell>
                      <TableCell>{item.last_run ?? "-"}</TableCell>
                      <TableCell>{accountName ?? "-"}</TableCell>
                      <TableCell>{categoryName ?? "-"}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatSignedCurrency(
                          item.amount_cents,
                          item.type,
                          item.currency_code ?? "USD"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.active ? "default" : "secondary"}>
                          {item.active ? "Active" : "Paused"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(item)}
                          >
                            {item.active ? "Pause" : "Resume"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRunNow(item)}
                            disabled={!item.active}
                          >
                            Run now
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSkipNext(item)}
                            disabled={!item.active}
                          >
                            Skip next
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete recurring transaction?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Future runs will stop immediately.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item.id!)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          {editing ? <RecurringForm recurring={editing} onSuccess={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
