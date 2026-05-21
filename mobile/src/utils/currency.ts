export function formatCurrency(amount: number | null | undefined, currency = "KES", locale = "en-KE"): string {
  if (amount == null) return `${currency} —`;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export const formatKES = (amount: number | null | undefined) =>
  formatCurrency(amount, "KES", "en-KE");
