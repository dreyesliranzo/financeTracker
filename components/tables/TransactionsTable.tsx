"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatSignedCurrency, parseCurrencyToCents } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { fetchAccounts, fetchCategories, fetchProfile, fetchTransactionsPage } from "@/lib/supabase/queries";
import { bulkDeleteTransactions, deleteTransaction, updateTransaction } from "@/lib/supabase/mutations";
import type { Transaction } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { EmptyState } from "@/components/empty/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { showSuccessToast } from "@/lib/toast";
import Link from "next/link";

const sortOptions = [
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" }
] as const;

export function TransactionsTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortKey, setSortKey] = useState("date");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineValues, setInlineValues] = useState({ merchant: "", amount: "" });
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const pageSize = 50;
  const hasFilters =
    deferredSearch.trim().length > 0 ||
    typeFilter !== "all" ||
    categoryFilter !== "all" ||
    accountFilter !== "all" ||
    currencyFilter !== "all" ||
    Boolean(startDate) ||
    Boolean(endDate);

  const transactionsQuery = useQuery({
    queryKey: [
      "transactions",
      startDate,
      endDate,
      currencyFilter,
      typeFilter,
      categoryFilter,
      accountFilter,
      deferredSearch,
      page,
      pageSize,
      sortKey
    ],
    queryFn: () =>
      fetchTransactionsPage({
        range: {
          start: startDate || undefined,
          end: endDate || undefined
        },
        filters: {
          currencyCode: currencyFilter === "all" ? undefined : currencyFilter,
          type: typeFilter === "all" ? undefined : (typeFilter as "income" | "expense"),
          categoryId: categoryFilter === "all" ? undefined : categoryFilter,
          accountId: accountFilter === "all" ? undefined : accountFilter,
          search: deferredSearch.trim().length > 0 ? deferredSearch : undefined
        },
        page,
        pageSize,
        sortKey: sortKey as "date" | "amount"
      }),
    placeholderData: (previous) => previous
  });
  const transactions = transactionsQuery.data?.data ?? [];
  const totalCount = transactionsQuery.data?.count ?? 0;
  const isLoading = transactionsQuery.isLoading;
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
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

  const rows = useMemo(() => transactions, [transactions]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paged = rows;

  const skeletonRows = useMemo(() => Array.from({ length: 6 }, (_, index) => index), []);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, typeFilter, categoryFilter, accountFilter, currencyFilter, startDate, endDate, sortKey]);

  useEffect(() => {
    if (profile?.default_currency && currencyFilter === "all") {
      setCurrencyFilter(profile.default_currency);
    }
  }, [currencyFilter, profile]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? paged.map((item) => item.id!).filter(Boolean) : []);
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const startInlineEdit = (transaction: Transaction) => {
    setInlineEditId(transaction.id ?? null);
    setInlineValues({
      merchant: transaction.merchant ?? "",
      amount: (transaction.amount_cents / 100).toFixed(2)
    });
  };

  const cancelInlineEdit = () => {
    setInlineEditId(null);
    setInlineValues({ merchant: "", amount: "" });
  };

  const saveInlineEdit = async () => {
    if (!inlineEditId) return;
    try {
      await updateTransaction(inlineEditId, {
        merchant: inlineValues.merchant.trim() || null,
        amount_cents: Math.abs(parseCurrencyToCents(inlineValues.amount))
      });
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      showSuccessToast("Transaction updated");
      cancelInlineEdit();
    } catch (error) {
      console.error(error);
      toast.error("Unable to update transaction");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      toast.success("Transaction deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete transaction");
    }
  };

  const handleBulkDelete = async () => {
    try {
      await bulkDeleteTransactions(selectedIds);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      toast.success("Transactions deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete transactions");
    }
  };

  if (!isLoading && totalCount === 0) {
    return (
      <EmptyState
        title={hasFilters ? "No matching transactions" : "No transactions yet"}
        description={
          hasFilters
            ? "Try adjusting your filters or search."
            : "Add your first transaction to see insights here."
        }
        action={
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add transaction</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <TransactionForm />
            </DialogContent>
          </Dialog>
        }
        secondaryAction={
          !hasFilters ? (
            <Button variant="secondary" asChild>
              <Link href="/settings">Import CSV</Link>
            </Button>
          ) : undefined
        }
        note={!hasFilters ? "Tip: Import a CSV to jumpstart your dashboard." : undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap gap-2">
          <Input
            placeholder="Search merchant or notes"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-[220px]"
          />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id!} value={category.id!}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id!} value={account.id!}>
                  {account.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All currencies</SelectItem>
              {currencyOptions.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-[150px]"
          />
          <Input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">Delete selected</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete transactions?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove {selectedIds.length} transactions.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleBulkDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <Select value={sortKey} onValueChange={setSortKey}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Add transaction</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <TransactionForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/70">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onCheckedChange={(value) => toggleSelectAll(Boolean(value))}
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? skeletonRows.map((row) => (
                  <TableRow key={`skeleton-${row}`}>
                    <TableCell>
                      <Skeleton className="h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-10" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Skeleton className="h-8 w-12" />
                        <Skeleton className="h-8 w-12" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              : paged.map((transaction) => {
                  const categoryName = transaction.category_id
                    ? categoryMap.get(transaction.category_id)
                    : undefined;
                  const accountName = transaction.account_id
                    ? accountMap.get(transaction.account_id)
                    : undefined;
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(transaction.id!)}
                          onCheckedChange={(value) =>
                            toggleSelect(transaction.id!, Boolean(value))
                          }
                        />
                      </TableCell>
                      <TableCell>{transaction.date}</TableCell>
                      <TableCell>
                        {inlineEditId === transaction.id ? (
                          <Input
                            value={inlineValues.merchant}
                            onChange={(event) =>
                              setInlineValues((prev) => ({
                                ...prev,
                                merchant: event.target.value
                              }))
                            }
                          />
                        ) : (
                          transaction.merchant ?? "-"
                        )}
                      </TableCell>
                      <TableCell>{categoryName ?? "-"}</TableCell>
                      <TableCell>{accountName ?? "-"}</TableCell>
                      <TableCell className="capitalize">{transaction.type}</TableCell>
                      <TableCell className="text-right font-medium">
                        {inlineEditId === transaction.id ? (
                          <Input
                            value={inlineValues.amount}
                            onChange={(event) =>
                              setInlineValues((prev) => ({
                                ...prev,
                                amount: event.target.value
                              }))
                            }
                            className="max-w-[120px] text-right"
                          />
                        ) : (
                          formatSignedCurrency(
                            transaction.amount_cents,
                            transaction.type,
                            transaction.currency_code ?? "USD"
                          )
                        )}
                      </TableCell>
                      <TableCell>{transaction.currency_code ?? "USD"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {inlineEditId === transaction.id ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={saveInlineEdit}>
                                Save
                              </Button>
                              <Button variant="ghost" size="sm" onClick={cancelInlineEdit}>
                                Cancel
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startInlineEdit(transaction)}
                              >
                                Quick edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditing(transaction)}
                              >
                                Edit
                              </Button>
                            </>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(transaction.id!)}>
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

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>
          Showing {totalCount === 0 ? 0 : (page - 1) * pageSize + 1}-
          {totalCount === 0 ? 0 : (page - 1) * pageSize + paged.length} of {totalCount}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-xs">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-w-2xl">
          {editing ? (
            <TransactionForm
              transaction={editing}
              onSuccess={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
