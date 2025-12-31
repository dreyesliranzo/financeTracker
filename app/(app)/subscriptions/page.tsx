"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { fetchAccounts, fetchCategories, fetchProfile, fetchSubscriptionCandidates } from "@/lib/supabase/queries";
import { createRecurringRule, deleteSubscriptionCandidate, snoozeSubscriptionCandidate } from "@/lib/supabase/mutations";
import { estimateMonthlyCents, intervalLabel, scheduleTextFromInterval, defaultNextDueDate, snoozeDateFromInterval } from "@/lib/utils/subscriptions";
import { formatCurrency } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { LoadingText } from "@/components/ui/LoadingText";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Stagger } from "@/components/layout/Stagger";
import { EmptyState } from "@/components/empty/EmptyState";
import { successToast } from "@/lib/feedback";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";
import type { SubscriptionCandidate } from "@/types";

type ConvertDraft = {
  scheduleText: string;
  nextDueDate: string;
  accountId: string;
  categoryId: string;
};

const scheduleOptions = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" }
] as const;

export default function SubscriptionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [convertOpen, setConvertOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<SubscriptionCandidate | null>(null);
  const [convertDraft, setConvertDraft] = useState<ConvertDraft>({
    scheduleText: "monthly",
    nextDueDate: "",
    accountId: "none",
    categoryId: "none"
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: fetchAccounts
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["subscription_candidates"],
    queryFn: fetchSubscriptionCandidates
  });
  const candidates = subscriptionsQuery.data ?? [];

  const monthlyTotals = useMemo(() => {
    return candidates
      .map((candidate) => ({
        ...candidate,
        monthly_cents: estimateMonthlyCents(candidate)
      }))
      .sort((a, b) => b.monthly_cents - a.monthly_cents);
  }, [candidates]);

  const totalMonthly = monthlyTotals.reduce((sum, item) => sum + item.monthly_cents, 0);

  const openConvert = (candidate: SubscriptionCandidate) => {
    setSelectedCandidate(candidate);
    setConvertDraft({
      scheduleText: scheduleTextFromInterval(candidate.interval_guess),
      nextDueDate: defaultNextDueDate(candidate),
      accountId: "none",
      categoryId: "none"
    });
    setConvertOpen(true);
  };

  const handleConvert = async () => {
    if (!selectedCandidate) return;
    if (!user) {
      toast.error("Please sign in to continue.");
      return;
    }

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
      const nextRunAt = convertDraft.nextDueDate
        ? new Date(convertDraft.nextDueDate).toISOString()
        : null;
      const template = {
        amount_cents: selectedCandidate.avg_amount_cents,
        type: "expense",
        transaction_kind: "expense",
        merchant: selectedCandidate.merchant,
        currency_code: profile?.default_currency ?? "USD",
        account_id: convertDraft.accountId === "none" ? null : convertDraft.accountId,
        category_id: convertDraft.categoryId === "none" ? null : convertDraft.categoryId
      };

      await createRecurringRule(user.id, {
        name: selectedCandidate.merchant,
        schedule_type: "cron",
        schedule_text: convertDraft.scheduleText,
        timezone,
        next_run_at: nextRunAt,
        template
      });

      await deleteSubscriptionCandidate(selectedCandidate.id!);
      successToast("Recurring rule created", "We will auto-post this subscription.");
      setConvertOpen(false);
      setSelectedCandidate(null);
      queryClient.invalidateQueries({ queryKey: ["subscription_candidates"] });
    } catch (error) {
      console.error(error);
      toast.error("Unable to create recurring rule.");
    }
  };

  const handleSnooze = async (candidate: SubscriptionCandidate) => {
    try {
      const nextDate = snoozeDateFromInterval(candidate.interval_guess, candidate.next_due_date);
      await snoozeSubscriptionCandidate(candidate.id!, nextDate);
      successToast("Subscription snoozed", `Next check-in: ${nextDate}`);
      queryClient.invalidateQueries({ queryKey: ["subscription_candidates"] });
    } catch (error) {
      console.error(error);
      toast.error("Unable to snooze subscription.");
    }
  };

  const handleIgnore = async (candidate: SubscriptionCandidate) => {
    try {
      await deleteSubscriptionCandidate(candidate.id!);
      successToast("Subscription ignored");
      queryClient.invalidateQueries({ queryKey: ["subscription_candidates"] });
    } catch (error) {
      console.error(error);
      toast.error("Unable to ignore subscription.");
    }
  };

  if (!subscriptionsQuery.isLoading && candidates.length === 0) {
    return (
      <EmptyState
        title="No subscriptions detected"
        description="We will surface recurring spend once enough transactions arrive."
        action={
          <Button onClick={() => router.push("/transactions")}>
            Review transactions
          </Button>
        }
        note="Tip: Add at least 3 payments to the same merchant to detect subscriptions."
      />
    );
  }

  return (
    <Stagger step={70} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Subscription hub</h1>
        <p className="text-sm text-muted-foreground">
          Review detected subscriptions and convert them to recurring rules.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Estimated subscriptions per month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {subscriptionsQuery.isLoading ? (
              <div className="space-y-2">
                <LoadingText label="Loading totals" />
                <Skeleton className="h-8 w-32" />
              </div>
            ) : (
              <div className="text-2xl font-semibold">
                {formatCurrency(totalMonthly, profile?.default_currency ?? "USD")}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Based on detected recurring merchants.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Top subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {subscriptionsQuery.isLoading ? (
              <>
                <LoadingText label="Loading list" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/4" />
              </>
            ) : (
              monthlyTotals.slice(0, 5).map((candidate) => (
                <div key={candidate.id} className="flex items-center justify-between">
                  <span className="truncate">{candidate.merchant}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(candidate.monthly_cents, profile?.default_currency ?? "USD")}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 bg-card/70">
        <CardHeader>
          <CardTitle>Detected subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead className="text-right">Avg amount</TableHead>
                  <TableHead>Next due</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptionsQuery.isLoading
                  ? Array.from({ length: 5 }, (_, index) => (
                      <TableRow key={`skeleton-${index}`}>
                        <TableCell colSpan={6}>
                          {index === 0 ? (
                            <div className="mb-2">
                              <LoadingText label="Loading subscriptions" />
                            </div>
                          ) : null}
                          <div className="grid gap-2">
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-20" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  : candidates.map((candidate) => {
                      const confidence = Math.round(candidate.confidence * 100);
                      return (
                        <TableRow key={candidate.id}>
                          <TableCell className="font-medium">{candidate.merchant}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{intervalLabel(candidate.interval_guess)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(
                              candidate.avg_amount_cents,
                              profile?.default_currency ?? "USD"
                            )}
                          </TableCell>
                          <TableCell>{candidate.next_due_date ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 rounded-full bg-muted">
                                <div
                                  className="h-1.5 rounded-full bg-emerald-400"
                                  style={{ width: `${confidence}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{confidence}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openConvert(candidate)}>
                                  Convert to recurring
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSnooze(candidate)}>
                                  Snooze
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleIgnore(candidate)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  Ignore
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    router.push(
                                      `/transactions?search=${encodeURIComponent(candidate.merchant)}` as Route
                                    )
                                  }
                                >
                                  View transactions
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={convertOpen}
        onOpenChange={(open) => {
          setConvertOpen(open);
          if (!open) {
            setSelectedCandidate(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold">Convert to recurring</h2>
              <p className="text-sm text-muted-foreground">
                Confirm account, category, and schedule before saving.
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Merchant</p>
              <p className="text-sm font-medium text-foreground">
                {selectedCandidate?.merchant ?? "-"}
              </p>
              <p className="mt-2 text-xs uppercase text-muted-foreground">Avg amount</p>
              <p className="text-sm font-medium text-foreground">
                {selectedCandidate
                  ? formatCurrency(
                      selectedCandidate.avg_amount_cents,
                      profile?.default_currency ?? "USD"
                    )
                  : "-"}
              </p>
            </div>

            <div className="grid gap-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Schedule</p>
                <Select
                  value={convertDraft.scheduleText}
                  onValueChange={(value) =>
                    setConvertDraft((prev) => ({ ...prev, scheduleText: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Next due date</p>
                <Input
                  type="date"
                  value={convertDraft.nextDueDate}
                  onChange={(event) =>
                    setConvertDraft((prev) => ({ ...prev, nextDueDate: event.target.value }))
                  }
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Account (optional)</p>
                <Select
                  value={convertDraft.accountId}
                  onValueChange={(value) =>
                    setConvertDraft((prev) => ({ ...prev, accountId: value }))
                  }
                >
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
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Category (optional)</p>
                <Select
                  value={convertDraft.categoryId}
                  onValueChange={(value) =>
                    setConvertDraft((prev) => ({ ...prev, categoryId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {categories
                      .filter((category) => category.type === "expense")
                      .map((category) => (
                        <SelectItem key={category.id!} value={category.id!}>
                          {category.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => setConvertOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConvert}>Save recurring</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Stagger>
  );
}
