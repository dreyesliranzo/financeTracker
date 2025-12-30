"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatSignedCurrency } from "@/lib/money";
import { fetchAccounts, fetchCategories, fetchTransactions } from "@/lib/supabase/queries";
import { bulkDeleteTransactions, deleteTransaction } from "@/lib/supabase/mutations";
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortKey, setSortKey] = useState("date");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["transactions", startDate, endDate],
    queryFn: () =>
      fetchTransactions({
        start: startDate || undefined,
        end: endDate || undefined
      })
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts
  });

  const filtered = useMemo(() => {
    return transactions
      .filter((transaction) => {
        if (typeFilter !== "all" && transaction.type !== typeFilter) {
          return false;
        }
        if (categoryFilter !== "all" && transaction.category_id !== categoryFilter) {
          return false;
        }
        if (accountFilter !== "all" && transaction.account_id !== accountFilter) {
          return false;
        }
        if (search.trim().length > 0) {
          const query = search.toLowerCase();
          const matchMerchant = transaction.merchant?.toLowerCase().includes(query);
          const matchNotes = transaction.notes?.toLowerCase().includes(query);
          const matchTags = transaction.tags?.some((tag) => tag.toLowerCase().includes(query));
          return Boolean(matchMerchant || matchNotes || matchTags);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortKey === "amount") {
          return b.amount_cents - a.amount_cents;
        }
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [transactions, typeFilter, categoryFilter, accountFilter, search, sortKey]);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filtered.map((item) => item.id!).filter(Boolean));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id)
    );
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
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
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast.success("Transactions deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete transactions");
    }
  };

  if (!isLoading && filtered.length === 0) {
    return (
      <EmptyState
        title="No transactions yet"
        description="Add your first transaction to see insights here."
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
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap gap-2">
          <Input
            placeholder="Search merchant, notes, tags"
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
                <SelectItem key={category.id} value={category.id}>
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
                <SelectItem key={account.id} value={account.id}>
                  {account.name}
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    filtered.length > 0 && selectedIds.length === filtered.length
                  }
                  onCheckedChange={(value) => toggleSelectAll(Boolean(value))}
                />
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Merchant</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((transaction) => {
              const category = categories.find(
                (item) => item.id === transaction.category_id
              );
              const account = accounts.find(
                (item) => item.id === transaction.account_id
              );
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
                  <TableCell>{transaction.merchant ?? "-"}</TableCell>
                  <TableCell>{category?.name ?? "-"}</TableCell>
                  <TableCell>{account?.name ?? "-"}</TableCell>
                  <TableCell className="capitalize">{transaction.type}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatSignedCurrency(transaction.amount_cents, transaction.type)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(transaction)}
                      >
                        Edit
                      </Button>
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
