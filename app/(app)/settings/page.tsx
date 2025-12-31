"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Papa from "papaparse";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AccountForm } from "@/components/forms/AccountForm";
import { CategoryForm } from "@/components/forms/CategoryForm";
import {
  fetchAccounts,
  fetchBudgets,
  fetchCategories,
  fetchOverallBudgets,
  fetchProfile,
  fetchTransactions
} from "@/lib/supabase/queries";
import { deleteAccount, deleteCategory, upsertProfile } from "@/lib/supabase/mutations";
import { parseCsv } from "@/lib/csv/parse";
import { requiredCsvFields, type CsvMapping } from "@/lib/csv/mapping";
import { useAuth } from "@/components/providers/AuthProvider";
import { parseCurrencyToCents } from "@/lib/money";
import { currencyOptions } from "@/lib/money/currencies";
import { createAccount, createCategory, createTransaction } from "@/lib/supabase/mutations";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAccent } from "@/components/providers/AccentProvider";
import { Stagger } from "@/components/layout/Stagger";

export default function SettingsPage() {
  const { user } = useAuth();
  const { accent, options: accentOptions, setAccent } = useAccent();
  const queryClient = useQueryClient();
  type CurrencyCode = (typeof currencyOptions)[number]["value"];
  const didInitCurrency = useRef(false);
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });
  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => fetchTransactions()
  });
  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => fetchBudgets()
  });
  const { data: overallBudgets = [] } = useQuery({
    queryKey: ["overall_budgets"],
    queryFn: () => fetchOverallBudgets()
  });
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<CsvMapping>({
    date: "",
    amount: "",
    type: "",
    category: "",
    account: "",
    currency: "",
    merchant: "",
    notes: "",
    tags: ""
  });
  const [isImporting, setIsImporting] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>("USD");
  const noneOption = "__none__";

  const mappingComplete = useMemo(() => {
    return requiredCsvFields.every((field) => Boolean(mapping[field]));
  }, [mapping]);

  const previewRows = useMemo(() => {
    return csvData.slice(0, 5);
  }, [csvData]);

  const csvStep = useMemo(() => {
    if (csvHeaders.length === 0) return 1;
    if (!mappingComplete) return 2;
    return 3;
  }, [csvHeaders.length, mappingComplete]);

  const csvSummary = useMemo(() => {
    if (!mappingComplete || csvData.length === 0) {
      return { total: csvData.length, missingRequired: 0, duplicates: 0 };
    }
    const missingRequired = csvData.filter((row) =>
      requiredCsvFields.some((field) => {
        const mapped = mapping[field];
        return !mapped || !row[mapped];
      })
    ).length;

    const existingKeys = new Set(
      transactions.map((transaction) =>
        makeTransactionKey({
          date: transaction.date,
          amount: transaction.amount_cents,
          type: transaction.type,
          accountId: transaction.account_id,
          categoryId: transaction.category_id,
          merchant: transaction.merchant ?? ""
        })
      )
    );

    const duplicateCount = csvData.reduce((acc, row) => {
      const dateValue = row[mapping.date];
      const amountValue = row[mapping.amount];
      if (!dateValue || !amountValue) return acc;
      const amountCents = Math.abs(parseCurrencyToCents(amountValue));
      const inferredType = amountValue.trim().startsWith("-") ? "expense" : "income";
      const typeValue = mapping.type ? row[mapping.type]?.toLowerCase() : inferredType;
      const type = typeValue?.includes("income") ? "income" : "expense";
      const key = makeTransactionKey({
        date: dateValue,
        amount: amountCents,
        type,
        accountId: null,
        categoryId: null,
        merchant: mapping.merchant ? row[mapping.merchant] : null
      });
      return existingKeys.has(key) ? acc + 1 : acc;
    }, 0);

    return {
      total: csvData.length,
      missingRequired,
      duplicates: duplicateCount
    };
  }, [csvData, mapping, mappingComplete, transactions]);

  const categoryNameMap = useMemo(() => {
    return new Map(
      categories
        .filter((category) => Boolean(category.id))
        .map((category) => [category.id!, category.name])
    );
  }, [categories]);

  const accountNameMap = useMemo(() => {
    return new Map(
      accounts
        .filter((account) => Boolean(account.id))
        .map((account) => [account.id!, account.name])
    );
  }, [accounts]);

  const autoMapHeaders = (headers: string[]) => {
    const normalized = headers.map((header) => header.toLowerCase());
    const findHeader = (candidates: string[]) => {
      const index = normalized.findIndex((header) =>
        candidates.some((candidate) => header.includes(candidate))
      );
      return index >= 0 ? headers[index] : "";
    };

    return {
      date: findHeader(["date", "posted", "transaction date"]),
      amount: findHeader(["amount", "amt", "value", "total"]),
      type: findHeader(["type", "transaction type"]),
      category: findHeader(["category", "cat"]),
      account: findHeader(["account", "acct", "card"]),
      currency: findHeader(["currency", "curr"]),
      merchant: findHeader(["merchant", "payee", "description", "name"]),
      notes: findHeader(["notes", "memo"]),
      tags: findHeader(["tags", "label"])
    };
  };

  const makeTransactionKey = (options: {
    date: string;
    amount: number;
    type: string;
    accountId?: string | null;
    categoryId?: string | null;
    merchant?: string | null;
  }) => {
    return [
      options.date,
      options.amount,
      options.type,
      options.accountId ?? "",
      options.categoryId ?? "",
      options.merchant?.toLowerCase() ?? ""
    ].join("|");
  };

  const handleCsvFile = async (file?: File | null) => {
    if (!file) return;
    try {
      const { headers, data } = await parseCsv(file);
      setCsvHeaders(headers);
      setCsvData(data);
      const detected = autoMapHeaders(headers);
      setMapping({
        date: detected.date,
        amount: detected.amount,
        type: detected.type,
        category: detected.category,
        account: detected.account,
        currency: detected.currency,
        merchant: detected.merchant,
        notes: detected.notes,
        tags: detected.tags
      });
    } catch (error) {
      console.error(error);
      toast.error("Unable to parse CSV");
    }
  };

  const handleImportCsv = async () => {
    if (!user) return;
    if (!mappingComplete) {
      toast.error("Map required fields first");
      return;
    }

    setIsImporting(true);
    try {
      const categoryMap = new Map(
        categories.map((category) => [category.name.toLowerCase(), category.id])
      );
      const accountMap = new Map(
        accounts.map((account) => [account.name.toLowerCase(), account.id])
      );
      const existingKeys = new Set(
        transactions.map((transaction) =>
          makeTransactionKey({
            date: transaction.date,
            amount: transaction.amount_cents,
            type: transaction.type,
            accountId: transaction.account_id,
            categoryId: transaction.category_id,
            merchant: transaction.merchant ?? ""
          })
        )
      );

      const ensureCategory = async (name: string, type: "income" | "expense") => {
        const key = name.toLowerCase();
        const existing = categoryMap.get(key);
        if (existing) return existing;
        const created = await createCategory(user.id, { name, type });
        categoryMap.set(key, created.id!);
        return created.id!;
      };

      const ensureAccount = async (name: string) => {
        const key = name.toLowerCase();
        const existing = accountMap.get(key);
        if (existing) return existing;
        const created = await createAccount(user.id, {
          name,
          type: "checking",
          account_class: "asset",
          currency_code: defaultCurrency
        });
        accountMap.set(key, created.id!);
        return created.id!;
      };

      const currencyLookup = new Set(
        currencyOptions.map((currency) => currency.value.toUpperCase())
      );

      let insertedCount = 0;
      let duplicateCount = 0;

      for (const row of csvData) {
        const dateValue = row[mapping.date];
        const amountValue = row[mapping.amount];
        if (!dateValue || !amountValue) continue;

        const amountCents = Math.abs(parseCurrencyToCents(amountValue));
        const inferredType = amountValue.trim().startsWith("-") ? "expense" : "income";
        const typeValue = mapping.type
          ? row[mapping.type]?.toLowerCase()
          : inferredType;
        const type = typeValue?.includes("income") ? "income" : "expense";

        const rawCategory = mapping.category ? row[mapping.category] : "";
        const rawAccount = mapping.account ? row[mapping.account] : "";
        const categoryName =
          rawCategory || (type === "expense" ? "Uncategorized" : "Income");
        const accountName = rawAccount || "Default";

        const categoryId = await ensureCategory(categoryName, type);
        const accountId = await ensureAccount(accountName);
        const currencyValue = mapping.currency
          ? row[mapping.currency]?.toUpperCase()
          : defaultCurrency;
        const currencyCode = (currencyLookup.has(currencyValue)
          ? currencyValue
          : defaultCurrency) as CurrencyCode;

        const key = makeTransactionKey({
          date: dateValue,
          amount: amountCents,
          type,
          accountId,
          categoryId,
          merchant: mapping.merchant ? row[mapping.merchant] : null
        });

        if (existingKeys.has(key)) {
          duplicateCount += 1;
          continue;
        }

        await createTransaction(user.id, {
          date: dateValue,
          amount_cents: amountCents,
          type,
          category_id: categoryId,
          account_id: accountId,
          currency_code: currencyCode,
          merchant: mapping.merchant ? row[mapping.merchant] : null,
          notes: mapping.notes ? row[mapping.notes] : null,
          tags: mapping.tags
            ? row[mapping.tags]
                ?.split(",")
                .map((tag) => tag.trim())
                .filter(Boolean) ?? []
            : []
        });
        insertedCount += 1;
        existingKeys.add(key);
      }

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      const message = `Imported ${insertedCount} transaction(s)`;
      toast.success(
        duplicateCount > 0
          ? `${message}. ${duplicateCount} duplicate(s) skipped.`
          : message
      );
      setCsvHeaders([]);
      setCsvData([]);
    } catch (error) {
      console.error(error);
      toast.error("CSV import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCsv = () => {
    const rows = transactions.map((transaction) => ({
      date: transaction.date,
      amount: (transaction.amount_cents / 100).toFixed(2),
      type: transaction.type,
      category: transaction.category_id
        ? categoryNameMap.get(transaction.category_id) ?? ""
        : "",
      account: transaction.account_id
        ? accountNameMap.get(transaction.account_id) ?? ""
        : "",
      currency: transaction.currency_code ?? "USD",
      merchant: transaction.merchant ?? "",
      notes: transaction.notes ?? "",
      tags: transaction.tags?.join(", ") ?? ""
    }));

    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ledgerly-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const payload = { accounts, categories, transactions, budgets, overall_budgets: overallBudgets };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ledgerly-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = async (file?: File | null) => {
    if (!user || !file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        accounts?: Array<Record<string, unknown>>;
        categories?: Array<Record<string, unknown>>;
        transactions?: Array<Record<string, unknown>>;
        budgets?: Array<Record<string, unknown>>;
        overall_budgets?: Array<Record<string, unknown>>;
      };

      const supabase = supabaseBrowser();
      if (parsed.accounts?.length) {
        const { error } = await supabase
          .from("accounts")
          .upsert(parsed.accounts.map((item) => ({ ...item, user_id: user.id })));
        if (error) throw error;
      }
      if (parsed.categories?.length) {
        const { error } = await supabase
          .from("categories")
          .upsert(parsed.categories.map((item) => ({ ...item, user_id: user.id })));
        if (error) throw error;
      }
      if (parsed.transactions?.length) {
        const { error } = await supabase
          .from("transactions")
          .upsert(parsed.transactions.map((item) => ({ ...item, user_id: user.id })));
        if (error) throw error;
      }
      if (parsed.budgets?.length) {
        const { error } = await supabase
          .from("budgets")
          .upsert(parsed.budgets.map((item) => ({ ...item, user_id: user.id })));
        if (error) throw error;
      }
      if (parsed.overall_budgets?.length) {
        const { error } = await supabase
          .from("overall_budgets")
          .upsert(parsed.overall_budgets.map((item) => ({ ...item, user_id: user.id })));
        if (error) throw error;
      }

      queryClient.invalidateQueries();
      toast.success("Backup restored");
    } catch (error) {
      console.error(error);
      toast.error("Unable to restore backup");
    }
  };

  const deleteWithToast = async (type: "account" | "category", id: string) => {
    try {
      if (type === "account") {
        await deleteAccount(id);
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      } else {
        await deleteCategory(id);
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      }
      toast.success(`${type === "account" ? "Account" : "Category"} deleted`);
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete item");
    }
  };

  useEffect(() => {
    if (!profile?.default_currency) return;
    if (didInitCurrency.current) return;
    didInitCurrency.current = true;
    setDefaultCurrency(profile.default_currency as CurrencyCode);
  }, [profile?.default_currency]);

  const handleCurrencyChange = async (value: string) => {
    if (!user) return;
    didInitCurrency.current = true;
    setDefaultCurrency(value as CurrencyCode);
    try {
      await upsertProfile({ user_id: user.id, default_currency: value as CurrencyCode });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Default currency updated");
    } catch (error) {
      console.error(error);
      toast.error("Unable to update currency");
    }
  };

  return (
    <Stagger step={60} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Customize your workspace and manage data.
        </p>
      </div>

      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="imports">Import/Export</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="categories">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Categories</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Add category</Button>
                </DialogTrigger>
                <DialogContent>
                  <CategoryForm />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 p-3"
                >
                  <div>
                    <p className="font-medium">
                      {category.icon ? `${category.icon} ` : ""}
                      {category.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {category.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <CategoryForm category={category} />
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete category?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Transactions linked to this category will keep the ID but show as
                            Uncategorized.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteWithToast("category", category.id!)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Accounts</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button>Add account</Button>
                </DialogTrigger>
                <DialogContent>
                  <AccountForm />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-xl border border-border/60 p-3"
                >
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {account.type} - {account.currency_code ?? "USD"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <AccountForm account={account} />
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Transactions linked to this account will keep the ID but show as
                            Unknown.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteWithToast("account", account.id!)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="imports">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>CSV import</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input type="file" accept=".csv" onChange={(event) => handleCsvFile(event.target.files?.[0])} />
                {csvHeaders.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
                      <span className={csvStep >= 1 ? "text-foreground" : ""}>1. Upload</span>
                      <span>-</span>
                      <span className={csvStep >= 2 ? "text-foreground" : ""}>2. Map</span>
                      <span>-</span>
                      <span className={csvStep >= 3 ? "text-foreground" : ""}>3. Review</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Map your columns</p>
                    {requiredCsvFields.map((field) => (
                      <div key={field} className="space-y-2">
                        <p className="text-xs uppercase text-muted-foreground">{field}</p>
                        <Select
                          value={mapping[field] ?? ""}
                          onValueChange={(value) =>
                            setMapping((prev) => ({ ...prev, [field]: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {csvHeaders.map((header) => (
                              <SelectItem key={header} value={header}>
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                    <div className="grid gap-2">
                      {(["type", "category", "account", "currency", "merchant", "notes", "tags"] as Array<keyof CsvMapping>).map((field) => (
                        <div key={field} className="space-y-2">
                          <p className="text-xs uppercase text-muted-foreground">{field}</p>
                          <Select
                            value={mapping[field] ?? ""}
                            onValueChange={(value) =>
                              setMapping((prev) => ({
                                ...prev,
                                [field]: value === noneOption ? "" : value
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Optional" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={noneOption}>None</SelectItem>
                              {csvHeaders.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    {previewRows.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Preview (first 5 rows)</p>
                        <div className="rounded-xl border border-border/60">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Account</TableHead>
                                <TableHead>Currency</TableHead>
                                <TableHead>Merchant</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {previewRows.map((row, index) => (
                                <TableRow key={`preview-${index}`}>
                                  <TableCell>{mapping.date ? row[mapping.date] : "-"}</TableCell>
                                  <TableCell>{mapping.amount ? row[mapping.amount] : "-"}</TableCell>
                                  <TableCell>{mapping.category ? row[mapping.category] : "-"}</TableCell>
                                  <TableCell>{mapping.account ? row[mapping.account] : "-"}</TableCell>
                                  <TableCell>{mapping.currency ? row[mapping.currency] : "-"}</TableCell>
                                  <TableCell>{mapping.merchant ? row[mapping.merchant] : "-"}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    ) : null}
                    {mappingComplete ? (
                      <div className="rounded-xl border border-border/60 p-3 text-sm">
                        <p className="font-medium">Validation summary</p>
                        <div className="mt-2 grid gap-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>Total rows</span>
                            <span className="text-foreground">{csvSummary.total}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Missing required fields</span>
                            <span className="text-foreground">{csvSummary.missingRequired}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Possible duplicates</span>
                            <span className="text-foreground">{csvSummary.duplicates}</span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <Button onClick={handleImportCsv} disabled={isImporting}>
                      {isImporting ? "Importing..." : "Import CSV"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Upload a CSV file to map columns and import transactions.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Export & backup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleExportCsv}>Export CSV</Button>
                <Button variant="secondary" onClick={handleExportJson}>
                  Download JSON backup
                </Button>
                <div>
                  <p className="text-sm text-muted-foreground">Restore from JSON backup</p>
                  <Input
                    type="file"
                    accept="application/json"
                    onChange={(event) => handleImportJson(event.target.files?.[0])}
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Theme</p>
                  <p className="text-sm text-muted-foreground">
                    Toggle between dark and light mode.
                  </p>
                </div>
                <ThemeToggle />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Default currency</p>
                  <p className="text-sm text-muted-foreground">
                    Applied to new accounts, budgets, and transactions.
                  </p>
                </div>
                <Select value={defaultCurrency} onValueChange={handleCurrencyChange}>
                  <SelectTrigger className="w-[180px]">
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
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Accent theme</p>
                  <p className="text-sm text-muted-foreground">
                    Customize the primary color and background glow.
                  </p>
                </div>
                <Select value={accent} onValueChange={setAccent}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {accentOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Stagger>
  );
}
