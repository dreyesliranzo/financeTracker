export function formatCurrency(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amountCents / 100);
}

export function parseCurrencyToCents(value: string) {
  const sanitized = value.replace(/[^0-9.-]/g, "");
  const amount = Number.parseFloat(sanitized);
  if (Number.isNaN(amount)) {
    return 0;
  }
  return Math.round(amount * 100);
}

export function formatSignedCurrency(
  amountCents: number,
  type: "income" | "expense",
  currency = "USD"
) {
  const sign = type === "expense" ? "-" : "+";
  return `${sign}${formatCurrency(amountCents, currency)}`;
}

export function clampCents(value: number) {
  return Math.max(0, Math.round(value));
}
