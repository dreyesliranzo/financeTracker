"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MoreHorizontal, PencilLine, Trash2, Eye, Filter } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatSignedCurrency, parseCurrencyToCents } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { fetchAccounts, fetchCategories, fetchProfile, fetchTransactionsPage } from "@/lib/supabase/queries";
import { bulkDeleteTransactions, createTransaction, deleteTransaction, updateTransaction } from "@/lib/supabase/mutations";
import type { Transaction } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TransactionForm } from "@/components/forms/TransactionForm";
import { EmptyState } from "@/components/empty/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingText } from "@/components/ui/LoadingText";
import { successToast } from "@/lib/feedback";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";

const sortOptions = [
  { value: "date", label: "Date" },
  { value: "amount", label: "Amount" }
] as const;

type SavedView = {
  id: string;
  name: string;
  filters: {
    search: string;
    typeFilter: string;
    categoryFilter: string;
    accountFilter: string;
    currencyFilter: string;
    startDate: string;
    endDate: string;
    sortKey: string;
  };
  createdAt: string;
};

export function TransactionsTable() {
  const router = useRouter();
  const { user } = useAuth();
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTransaction, setDetailTransaction] = useState<Transaction | null>(null);
  const [activeRow, setActiveRow] = useState<Transaction | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineValues, setInlineValues] = useState({ merchant: "", amount: "" });
  const [addOpen, setAddOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [saveViewOpen, setSaveViewOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkAccountOpen, setBulkAccountOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("none");
  const [bulkAccountId, setBulkAccountId] = useState("none");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search");
  const urlCategory = searchParams.get("category");
  const urlType = searchParams.get("type");
  const urlAccount = searchParams.get("account");
  const urlStart = searchParams.get("start");
  const urlEnd = searchParams.get("end");
  const tableRef = useRef<HTMLTableElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const storageKey = user?.id ? `ledgerly:savedViews:${user.id}` : "ledgerly:savedViews:anon";
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
          type: typeFilter === "all" ? undefined : (typeFilter as "income" | "expense" | "transfer"),
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

  const rowVirtualizer = useVirtualizer({
    count: paged.length,
    getScrollElement: () => tableRef.current?.parentElement ?? null,
    estimateSize: () => 56,
    overscan: 8
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    rowVirtualizer.getTotalSize() -
    (virtualRows.length > 0 ? virtualRows[virtualRows.length - 1].end : 0);
  const selectedTransactions = useMemo(
    () => rows.filter((transaction) => selectedIds.includes(transaction.id ?? "")),
    [rows, selectedIds]
  );
  const primarySelection = useMemo(() => {
    if (activeRow) return activeRow;
    if (selectedIds.length === 1) return selectedTransactions[0] ?? null;
    return null;
  }, [activeRow, selectedIds.length, selectedTransactions]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, typeFilter, categoryFilter, accountFilter, currencyFilter, startDate, endDate, sortKey]);

  useEffect(() => {
    if (!urlSearch) return;
    setSearch((current) => (current ? current : urlSearch));
  }, [urlSearch]);

  useEffect(() => {
    if (urlCategory && categoryFilter === "all") {
      setCategoryFilter(urlCategory);
    }
  }, [categoryFilter, urlCategory]);

  useEffect(() => {
    if (urlType && typeFilter === "all") {
      setTypeFilter(urlType);
    }
  }, [typeFilter, urlType]);

  useEffect(() => {
    if (urlAccount && accountFilter === "all") {
      setAccountFilter(urlAccount);
    }
  }, [accountFilter, urlAccount]);

  useEffect(() => {
    if (urlStart && !startDate) {
      setStartDate(urlStart);
    }
  }, [startDate, urlStart]);

  useEffect(() => {
    if (urlEnd && !endDate) {
      setEndDate(urlEnd);
    }
  }, [endDate, urlEnd]);

  useEffect(() => {
    if (profile?.default_currency && currencyFilter === "all") {
      setCurrencyFilter(profile.default_currency);
    }
  }, [currencyFilter, profile]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        categoryId?: string;
        search?: string;
      };
      if (detail?.categoryId) {
        setCategoryFilter(detail.categoryId);
      }
      if (typeof detail?.search === "string") {
        setSearch(detail.search);
      }
    };
    window.addEventListener("app:transactions:filter", handler);
    return () => window.removeEventListener("app:transactions:filter", handler);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setSavedViews([]);
        return;
      }
      const parsed = JSON.parse(raw) as SavedView[];
      if (Array.isArray(parsed)) {
        setSavedViews(parsed);
      }
    } catch (error) {
      console.error(error);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(savedViews));
  }, [savedViews, storageKey]);

  const applySavedView = (view: SavedView) => {
    setSearch(view.filters.search);
    setTypeFilter(view.filters.typeFilter);
    setCategoryFilter(view.filters.categoryFilter);
    setAccountFilter(view.filters.accountFilter);
    setCurrencyFilter(view.filters.currencyFilter);
    setStartDate(view.filters.startDate);
    setEndDate(view.filters.endDate);
    setSortKey(view.filters.sortKey);
    setPage(1);
  };

  const handleSaveView = () => {
    const trimmed = viewName.trim();
    if (!trimmed) {
      toast.error("Name your view first");
      return;
    }
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextView: SavedView = {
      id,
      name: trimmed,
      filters: {
        search,
        typeFilter,
        categoryFilter,
        accountFilter,
        currencyFilter,
        startDate,
        endDate,
        sortKey
      },
      createdAt: new Date().toISOString()
    };
    setSavedViews((prev) => [
      nextView,
      ...prev.filter((view) => view.name.toLowerCase() !== trimmed.toLowerCase())
    ]);
    setSaveViewOpen(false);
    setViewName("");
    successToast("Saved view created");
  };

  const handleClearViews = () => {
    setSavedViews([]);
    successToast("Saved views cleared");
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (filtersDialogOpen || detailOpen || addOpen || saveViewOpen) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (event.key.toLowerCase() === "a") {
        event.preventDefault();
        setAddOpen(true);
        return;
      }

      if (event.key.toLowerCase() === "e") {
        if (primarySelection) {
          event.preventDefault();
          setEditing(primarySelection);
        }
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        if (selectedIds.length > 1) {
          handleBulkDelete();
          return;
        }
        if (primarySelection) {
          handleDelete(primarySelection);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [addOpen, detailOpen, filtersDialogOpen, primarySelection, saveViewOpen, selectedIds.length]);

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
      successToast("Transaction updated");
      cancelInlineEdit();
    } catch (error) {
      console.error(error);
      toast.error("Unable to update transaction");
    }
  };

  const restoreTransactions = async (items: Transaction[]) => {
    if (!user) {
      toast.error("Please sign in to restore.");
      return;
    }
    if (!items.length) return;
    try {
      await Promise.all(
        items.map((transaction) => {
          const kind = (transaction.transaction_kind ?? transaction.type) as "income" | "expense" | "transfer";
          return createTransaction(user.id, {
            date: transaction.date,
            amount_cents: transaction.amount_cents,
            type: kind,
            category_id: transaction.category_id ?? null,
            account_id: transaction.account_id ?? null,
            from_account_id: transaction.from_account_id ?? null,
            to_account_id: transaction.to_account_id ?? null,
            currency_code: transaction.currency_code ?? "USD",
            merchant: transaction.merchant ?? null,
            notes: transaction.notes ?? null,
            tags: transaction.tags ?? [],
            transaction_splits:
              transaction.transaction_splits?.map((split) => ({
                category_id: split.category_id ?? null,
                amount_cents: split.amount_cents,
                note: split.note ?? null
              })) ?? []
          });
        })
      );
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      successToast("Transactions restored");
    } catch (error) {
      console.error(error);
      toast.error("Unable to restore transactions");
    }
  };

  const handleDelete = async (transaction: Transaction) => {
    try {
      await deleteTransaction(transaction.id!);
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      toast("Transaction deleted", {
        action: {
          label: "Undo",
          onClick: () => restoreTransactions([transaction])
        }
      });
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete transaction");
    }
  };

  const handleBulkDelete = async () => {
    const toRestore = selectedTransactions;
    try {
      await bulkDeleteTransactions(selectedIds);
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      toast("Transactions deleted", {
        action: {
          label: "Undo",
          onClick: () => restoreTransactions(toRestore)
        }
      });
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete transactions");
    }
  };

  const handleBulkRecategorize = async () => {
    const targetCategory = bulkCategoryId === "none" ? null : bulkCategoryId;
    const editable = selectedTransactions.filter((transaction) => {
      const kind = transaction.transaction_kind ?? transaction.type;
      return kind !== "transfer";
    });
    if (!editable.length) {
      toast.error("No editable transactions selected.");
      return;
    }
    try {
      await Promise.all(
        editable.map((transaction) =>
          updateTransaction(transaction.id!, { category_id: targetCategory })
        )
      );
      setSelectedIds([]);
      setBulkCategoryOpen(false);
      setBulkCategoryId("none");
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["overall_budgets"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      successToast("Transactions updated");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update categories");
    }
  };

  const handleBulkMoveAccount = async () => {
    const targetAccount = bulkAccountId === "none" ? null : bulkAccountId;
    const editable = selectedTransactions.filter((transaction) => {
      const kind = transaction.transaction_kind ?? transaction.type;
      return kind !== "transfer";
    });
    if (!editable.length) {
      toast.error("No editable transactions selected.");
      return;
    }
    try {
      await Promise.all(
        editable.map((transaction) =>
          updateTransaction(transaction.id!, { account_id: targetAccount })
        )
      );
      setSelectedIds([]);
      setBulkAccountOpen(false);
      setBulkAccountId("none");
      queryClient.invalidateQueries({ queryKey: ["transactions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["insights"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["dashboard"], exact: false });
      successToast("Transactions updated");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update accounts");
    }
  };

  if (!isLoading && totalCount === 0) {
    return (
      <>
        <EmptyState
          title={hasFilters ? "No matching transactions" : "No transactions yet"}
          description={
            hasFilters
              ? "Try adjusting your filters or search."
              : "Add your first transaction to see insights here."
          }
          action={
            <Button onClick={() => setAddOpen(true)}>Add transaction</Button>
          }
          secondaryAction={
            !hasFilters ? (
              <Button variant="secondary" onClick={() => router.push("/settings")}>
                Import CSV
              </Button>
            ) : undefined
          }
          note={!hasFilters ? "Tip: Import a CSV to jumpstart your dashboard." : undefined}
        />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-2xl">
            <TransactionForm />
          </DialogContent>
        </Dialog>
      </>
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
            className="min-w-[240px]"
            ref={searchRef}
          />
          <Dialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
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
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Account</p>
                  <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger>
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
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Currency</p>
                  <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                    <SelectTrigger>
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
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </div>
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setTypeFilter("all");
                      setCategoryFilter("all");
                      setAccountFilter("all");
                      setCurrencyFilter("all");
                      setStartDate("");
                      setEndDate("");
                    }}
                  >
                    Clear
                  </Button>
                  <Button size="sm" onClick={() => setFiltersDialogOpen(false)}>
                    Apply
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Saved views
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {savedViews.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  No saved views yet.
                </div>
              ) : (
                savedViews.map((view) => (
                  <DropdownMenuItem key={view.id} onClick={() => applySavedView(view)}>
                    {view.name}
                  </DropdownMenuItem>
                ))
              )}
              {savedViews.length > 0 ? (
                <DropdownMenuItem onClick={handleClearViews} className="text-destructive focus:text-destructive">
                  Clear saved views
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setSaveViewOpen(true)}>
            Save view
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Bulk actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setBulkCategoryOpen(true)}>
                    Recategorize
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBulkAccountOpen(true)}>
                    Move account
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            </>
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
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setAddOpen(true)}>Add transaction</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <TransactionForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {hasFilters || deferredSearch ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {deferredSearch ? (
            <Badge variant="secondary" className="gap-1">
              Search: {deferredSearch}
              <button
                className="ml-1 rounded-full px-1 text-[10px]"
                type="button"
                onClick={() => setSearch("")}
              >
                ×
              </button>
            </Badge>
          ) : null}
          {typeFilter !== "all" ? (
            <Badge variant="secondary" className="gap-1">
              Type: {typeFilter}
              <button
                className="ml-1 rounded-full px-1 text-[10px]"
                type="button"
                onClick={() => setTypeFilter("all")}
              >
                ×
              </button>
            </Badge>
          ) : null}
          {categoryFilter !== "all" ? (
            <Badge variant="secondary" className="gap-1">
              Category: {categoryMap.get(categoryFilter) ?? "Category"}
              <button
                className="ml-1 rounded-full px-1 text-[10px]"
                type="button"
                onClick={() => setCategoryFilter("all")}
              >
                ×
              </button>
            </Badge>
          ) : null}
          {accountFilter !== "all" ? (
            <Badge variant="secondary" className="gap-1">
              Account: {accountMap.get(accountFilter) ?? "Account"}
              <button
                className="ml-1 rounded-full px-1 text-[10px]"
                type="button"
                onClick={() => setAccountFilter("all")}
              >
                ×
              </button>
            </Badge>
          ) : null}
          {currencyFilter !== "all" ? (
            <Badge variant="secondary" className="gap-1">
              Currency: {currencyFilter}
              <button
                className="ml-1 rounded-full px-1 text-[10px]"
                type="button"
                onClick={() => setCurrencyFilter("all")}
              >
                ×
              </button>
            </Badge>
          ) : null}
          {startDate ? (
            <Badge variant="secondary" className="gap-1">
              From {startDate}
              <button
                className="ml-1 rounded-full px-1 text-[10px]"
                type="button"
                onClick={() => setStartDate("")}
              >
                ×
              </button>
            </Badge>
          ) : null}
          {endDate ? (
            <Badge variant="secondary" className="gap-1">
              To {endDate}
              <button
                className="ml-1 rounded-full px-1 text-[10px]"
                type="button"
                onClick={() => setEndDate("")}
              >
                ×
              </button>
            </Badge>
          ) : null}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingText label="Loading transactions" className="ml-1" />
      ) : null}

      <div className="rounded-2xl border border-border/60 bg-card/70">
        <Table
          ref={tableRef}
          className="min-w-[980px]"
          wrapperClassName="max-h-[70vh] lg:max-h-[640px]"
        >
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
            {isLoading ? (
              skeletonRows.map((row) => (
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
            ) : (
              <>
                {paddingTop > 0 ? (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={9} style={{ height: paddingTop }} />
                  </TableRow>
                ) : null}
                {virtualRows.map((virtualRow) => {
                  const transaction = paged[virtualRow.index];
                  const kind = (transaction.transaction_kind ?? transaction.type) as "income" | "expense" | "transfer";
                  const categoryName = transaction.category_id
                    ? categoryMap.get(transaction.category_id)
                    : undefined;
                  const accountName = transaction.account_id
                    ? accountMap.get(transaction.account_id)
                    : undefined;
                  const fromAccount = transaction.from_account_id
                    ? accountMap.get(transaction.from_account_id)
                    : undefined;
                  const toAccount = transaction.to_account_id
                    ? accountMap.get(transaction.to_account_id)
                    : undefined;
                  const hasSplits = (transaction.transaction_splits?.length ?? 0) > 0;
                  return (
                    <TableRow
                      key={transaction.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => {
                        setActiveRow(transaction);
                        setDetailTransaction(transaction);
                        setDetailOpen(true);
                      }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.includes(transaction.id!)}
                          onCheckedChange={(value) =>
                            toggleSelect(transaction.id!, Boolean(value))
                          }
                        />
                      </TableCell>
                      <TableCell>{transaction.date}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
                            <span>{transaction.merchant ?? "-"}</span>
                          )}
                          {kind === "transfer" ? (
                            <Badge variant="outline" className="text-xs">
                              Transfer
                            </Badge>
                          ) : null}
                          {hasSplits ? (
                            <Badge variant="outline" className="text-xs">
                              Split
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {hasSplits
                          ? "Split across categories"
                          : categoryName ?? "-"}
                      </TableCell>
                      <TableCell>
                        {kind === "transfer"
                          ? `${fromAccount ?? "-"} -> ${toAccount ?? "-"}`
                          : accountName ?? "-"}
                      </TableCell>
                      <TableCell className="capitalize">{kind}</TableCell>
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
                        ) : kind === "transfer" ? (
                          formatCurrency(transaction.amount_cents, transaction.currency_code ?? "USD")
                        ) : (
                          formatSignedCurrency(
                            transaction.amount_cents,
                            kind === "income" ? "income" : "expense",
                            transaction.currency_code ?? "USD"
                          )
                        )}
                      </TableCell>
                      <TableCell>{transaction.currency_code ?? "USD"}</TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {inlineEditId === transaction.id ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={saveInlineEdit}>
                              Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelInlineEdit}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => startInlineEdit(transaction)}
                                className="gap-2"
                              >
                                <PencilLine className="h-4 w-4" /> Quick edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setEditing(transaction)}
                                className="gap-2"
                              >
                                <Eye className="h-4 w-4" /> Edit in modal
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => handleDelete(transaction)}
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paddingBottom > 0 ? (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={9} style={{ height: paddingBottom }} />
                  </TableRow>
                ) : null}
              </>
            )}
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

      <Dialog open={saveViewOpen} onOpenChange={setSaveViewOpen}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Save view</h3>
              <p className="text-sm text-muted-foreground">
                Store this filter set for quick access.
              </p>
            </div>
            <Input
              placeholder="View name"
              value={viewName}
              onChange={(event) => setViewName(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSaveViewOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveView}>Save view</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Recategorize</h3>
              <p className="text-sm text-muted-foreground">
                Apply a new category to {selectedIds.length} transactions.
              </p>
            </div>
            <Select value={bulkCategoryId} onValueChange={setBulkCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Uncategorized</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id!} value={category.id!}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBulkCategoryOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkRecategorize}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkAccountOpen} onOpenChange={setBulkAccountOpen}>
        <DialogContent className="max-w-md">
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Move account</h3>
              <p className="text-sm text-muted-foreground">
                Apply a new account to {selectedIds.length} transactions.
              </p>
            </div>
            <Select value={bulkAccountId} onValueChange={setBulkAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No account</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id!} value={account.id!}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBulkAccountOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkMoveAccount}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="w-full max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Transaction details</SheetTitle>
          </SheetHeader>
          {detailTransaction ? (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div>
                  <p className="text-xs uppercase">Date</p>
                  <p className="text-foreground">{detailTransaction.date}</p>
                </div>
                <div>
                  <p className="text-xs uppercase">Merchant</p>
                  <p className="text-foreground">{detailTransaction.merchant ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase">Category</p>
                  <p className="text-foreground">
                    {detailTransaction.transaction_splits?.length
                      ? "Split across categories"
                      : detailTransaction.category_id
                        ? categoryMap.get(detailTransaction.category_id) ?? "-"
                        : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase">Account</p>
                  <p className="text-foreground">
                    {(detailTransaction.transaction_kind ?? detailTransaction.type) === "transfer"
                      ? `${accountMap.get(detailTransaction.from_account_id ?? "") ?? "-"} -> ${accountMap.get(detailTransaction.to_account_id ?? "") ?? "-"}`
                      : detailTransaction.account_id
                        ? accountMap.get(detailTransaction.account_id) ?? "-"
                        : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase">Amount</p>
                  <p className="text-foreground font-semibold">
                    {(detailTransaction.transaction_kind ?? detailTransaction.type) === "transfer"
                      ? formatCurrency(detailTransaction.amount_cents, detailTransaction.currency_code ?? "USD")
                      : formatSignedCurrency(
                          detailTransaction.amount_cents,
                          (detailTransaction.transaction_kind ?? detailTransaction.type) === "income" ? "income" : "expense",
                          detailTransaction.currency_code ?? "USD"
                        )}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase">Currency</p>
                  <p className="text-foreground">{detailTransaction.currency_code ?? "USD"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs uppercase">Notes</p>
                  <p className="text-foreground">
                    {detailTransaction.notes?.length ? detailTransaction.notes : "-"}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                <p className="mb-2 text-sm font-semibold text-foreground">Edit</p>
                <TransactionForm
                  transaction={detailTransaction}
                  onSuccess={() => {
                    setDetailOpen(false);
                    setDetailTransaction(null);
                  }}
                />
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
