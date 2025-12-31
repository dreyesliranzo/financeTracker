"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { fetchBudgets, fetchCategories, fetchProfile, fetchTransactionsSummary } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/money";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const prompts = [
  "Give me a quick spending summary",
  "What are my top categories?",
  "How are my budgets doing?",
  "How can I save more?"
];

export function AdvisorChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I can summarize your spending, budgets, and savings tips. Ask me anything."
    }
  ]);

  const rangeStart = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const rangeEnd = format(new Date(), "yyyy-MM-dd");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });

  const currency = profile?.default_currency ?? "USD";

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions", "summary", rangeStart, rangeEnd, currency],
    queryFn: () =>
      fetchTransactionsSummary({ start: rangeStart, end: rangeEnd }, currency)
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories
  });

  const month = format(new Date(), "yyyy-MM");
  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets", month, currency],
    queryFn: () => fetchBudgets(`${month}-01`, currency)
  });

  const categoryNameMap = useMemo(() => {
    return new Map(
      categories
        .filter((category) => Boolean(category.id))
        .map((category) => [category.id!, category.name])
    );
  }, [categories]);

  const summary = useMemo(() => {
    return transactions.reduce(
      (acc, transaction) => {
        if (transaction.type === "income") {
          acc.income += transaction.amount_cents;
        } else {
          acc.expense += transaction.amount_cents;
        }
        return acc;
      },
      { income: 0, expense: 0 }
    );
  }, [transactions]);

  const topCategory = useMemo(() => {
    const totals = new Map<string, number>();
    transactions
      .filter((transaction) => (transaction.transaction_kind ?? transaction.type) === "expense")
      .forEach((transaction) => {
        const key = transaction.category_id ?? "uncategorized";
        totals.set(key, (totals.get(key) ?? 0) + transaction.amount_cents);
      });
    const [categoryId, amount] =
      Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0] ?? [];
    return {
      name: categoryId ? categoryNameMap.get(categoryId) ?? "Uncategorized" : "None",
      amount: amount ?? 0
    };
  }, [categoryNameMap, transactions]);

  const topMerchant = useMemo(() => {
    const totals = new Map<string, number>();
    transactions
      .filter(
        (transaction) =>
          (transaction.transaction_kind ?? transaction.type) === "expense" && transaction.merchant
      )
      .forEach((transaction) => {
        const key = transaction.merchant ?? "Unknown";
        totals.set(key, (totals.get(key) ?? 0) + transaction.amount_cents);
      });
    const [merchant, amount] =
      Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0] ?? [];
    return {
      name: merchant ?? "None",
      amount: amount ?? 0
    };
  }, [transactions]);

  const budgetStatus = useMemo(() => {
    if (budgets.length === 0) {
      return "You do not have budgets yet. Add one to start tracking.";
    }
    const spentByCategory = new Map<string, number>();
    transactions
      .filter((transaction) => (transaction.transaction_kind ?? transaction.type) === "expense")
      .forEach((transaction) => {
        const key = transaction.category_id ?? "uncategorized";
        spentByCategory.set(key, (spentByCategory.get(key) ?? 0) + transaction.amount_cents);
      });

    const highestRatio = budgets.reduce(
      (acc, budget) => {
        const spent = spentByCategory.get(budget.category_id) ?? 0;
        const ratio = budget.limit_cents ? spent / budget.limit_cents : 0;
        if (ratio > acc.ratio) {
          return {
            ratio,
            name: categoryNameMap.get(budget.category_id) ?? "Uncategorized"
          };
        }
        return acc;
      },
      { ratio: 0, name: "None" }
    );

    return `Your most used budget is ${highestRatio.name} at ${Math.round(
      highestRatio.ratio * 100
    )}% utilization.`;
  }, [budgets, categoryNameMap, transactions]);

  const savingsRate = useMemo(() => {
    if (summary.income === 0) return 0;
    return Math.max(0, (summary.income - summary.expense) / summary.income);
  }, [summary]);

  const buildResponse = (prompt: string) => {
    const text = prompt.toLowerCase();
    if (text.includes("category")) {
      return `Top category is ${topCategory.name} at ${formatCurrency(
        topCategory.amount,
        currency
      )}.`;
    }
    if (text.includes("merchant")) {
      return `Top merchant is ${topMerchant.name} at ${formatCurrency(
        topMerchant.amount,
        currency
      )}.`;
    }
    if (text.includes("budget")) {
      return budgetStatus;
    }
    if (text.includes("save")) {
      return `Your savings rate is about ${Math.round(
        savingsRate * 100
      )}%. Consider automating a transfer for 5-10% of income.`;
    }
    return `Last 30 days: ${formatCurrency(summary.income, currency)} income, ${formatCurrency(
      summary.expense,
      currency
    )} expenses, net ${formatCurrency(
      summary.income - summary.expense,
      currency
    )}.`;
  };

  const sendMessage = (content: string) => {
    if (!content.trim()) return;
    const userMessage = content.trim();
    const response = buildResponse(userMessage);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage },
      { role: "assistant", content: response }
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt) => (
          <Button key={prompt} variant="secondary" size="sm" onClick={() => sendMessage(prompt)}>
            {prompt}
          </Button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/60 p-4">
        <p className="text-sm text-muted-foreground">
          Choose a prompt below and I will generate a tailored response.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {prompts.map((prompt) => (
            <Button key={prompt} variant="secondary" size="sm" onClick={() => sendMessage(prompt)}>
              {prompt}
            </Button>
          ))}
        </div>
        <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-2">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  message.role === "user"
                    ? "bg-primary/15 text-foreground"
                    : "bg-muted/40 text-muted-foreground"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
