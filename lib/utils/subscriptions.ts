import { addMonths, addWeeks, format } from "date-fns";
import type { SubscriptionCandidate } from "@/types";

const MONTHLY_MULTIPLIERS: Record<string, number> = {
  weekly: 52 / 12,
  monthly: 1,
  unknown: 1
};

export function estimateMonthlyCents(candidate: SubscriptionCandidate) {
  const multiplier = MONTHLY_MULTIPLIERS[candidate.interval_guess] ?? 1;
  return Math.round(candidate.avg_amount_cents * multiplier);
}

export function intervalLabel(interval: SubscriptionCandidate["interval_guess"]) {
  switch (interval) {
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    default:
      return "Unknown";
  }
}

export function scheduleTextFromInterval(interval: SubscriptionCandidate["interval_guess"]) {
  switch (interval) {
    case "weekly":
      return "weekly";
    case "monthly":
      return "monthly";
    default:
      return "monthly";
  }
}

export function defaultNextDueDate(candidate: SubscriptionCandidate) {
  if (candidate.next_due_date) return candidate.next_due_date;
  const base = new Date();
  const next =
    candidate.interval_guess === "weekly" ? addWeeks(base, 1) : addMonths(base, 1);
  return format(next, "yyyy-MM-dd");
}

export function snoozeDateFromInterval(
  interval: SubscriptionCandidate["interval_guess"],
  baseDate?: string | null
) {
  const base = baseDate ? new Date(baseDate) : new Date();
  const next = interval === "weekly" ? addWeeks(base, 1) : addMonths(base, 1);
  return format(next, "yyyy-MM-dd");
}
