import { addDays, addMonths, addWeeks, addYears, format, parseISO } from "date-fns";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { RecurringTransaction, Transaction } from "@/types";

type MaterializeResult = {
  inserted: number;
  updated: number;
};

function formatDate(value: Date) {
  return format(value, "yyyy-MM-dd");
}

function advanceDate(date: string, cadence: RecurringTransaction["cadence"]) {
  const base = parseISO(date);
  switch (cadence) {
    case "daily":
      return addDays(base, 1);
    case "weekly":
      return addWeeks(base, 1);
    case "biweekly":
      return addWeeks(base, 2);
    case "monthly":
      return addMonths(base, 1);
    case "quarterly":
      return addMonths(base, 3);
    case "yearly":
      return addYears(base, 1);
    default:
      return addMonths(base, 1);
  }
}

export async function materializeRecurringTransactions(
  userId: string
): Promise<MaterializeResult | null> {
  const supabase = supabaseBrowser();
  const today = formatDate(new Date());
  const { data, error } = await supabase
    .from("recurring_transactions")
    .select("*")
    .eq("active", true)
    .lte("next_run", today);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const inserts: Array<Omit<Transaction, "id" | "created_at" | "updated_at">> = [];
  const updates: Array<Pick<RecurringTransaction, "id" | "next_run" | "last_run" | "active">> = [];

  data.forEach((recurring) => {
    let nextRun = recurring.next_run;
    let lastRun = recurring.last_run ?? null;
    let currentRun = recurring.next_run;
    let iterations = 0;

    while (currentRun <= today && iterations < 120) {
      if (recurring.end_date && currentRun > recurring.end_date) {
        break;
      }

      inserts.push({
        user_id: userId,
        date: currentRun,
        amount_cents: recurring.amount_cents,
        type: recurring.type,
        category_id: recurring.category_id ?? null,
        account_id: recurring.account_id ?? null,
        currency_code: recurring.currency_code ?? "USD",
        merchant: recurring.merchant ?? null,
        notes: recurring.notes ?? null,
        tags: recurring.tags ?? []
      });

      lastRun = currentRun;
      nextRun = formatDate(advanceDate(currentRun, recurring.cadence));
      currentRun = nextRun;
      iterations += 1;
    }

    if (lastRun && lastRun !== recurring.last_run) {
      const stillActive = recurring.end_date ? nextRun <= recurring.end_date : true;
      updates.push({
        id: recurring.id!,
        next_run: nextRun,
        last_run: lastRun,
        active: stillActive
      });
    }
  });

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("transactions").insert(inserts);
    if (insertError) throw insertError;
  }

  if (updates.length > 0) {
    const { error: updateError } = await supabase
      .from("recurring_transactions")
      .upsert(updates);
    if (updateError) throw updateError;
  }

  return { inserted: inserts.length, updated: updates.length };
}
