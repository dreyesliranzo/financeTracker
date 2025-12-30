"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatSignedCurrency } from "@/lib/money";
import { fetchAccounts, fetchCategories, fetchRecurringTransactions } from "@/lib/supabase/queries";
import { deleteRecurringTransaction, updateRecurringTransaction } from "@/lib/supabase/mutations";
import type { RecurringTransaction } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecurringForm } from "@/components/forms/RecurringForm";
import { EmptyState } from "@/components/empty/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";

export function RecurringTransactionsTable() {
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

  const handleToggleActive = async (item: RecurringTransaction) => {
    try {
      await updateRecurringTransaction(item.id!, { active: !item.active });
      queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] });
      toast.success(item.active ? "Recurring paused" : "Recurring resumed");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update recurring transaction");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRecurringTransaction(id);
      queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] });
      toast.success("Recurring transaction deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete recurring transaction");
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
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Automate repeating entries and keep schedules in sync.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button>New recurring</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <RecurringForm />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Cadence</TableHead>
              <TableHead>Next run</TableHead>
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
