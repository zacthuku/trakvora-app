export function formatCurrency(amount, currency = "KES", locale = "en-KE") {
  if (amount == null) return `${currency} —`;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Legacy alias — kept for any imports not yet migrated
export const formatKES = (amount) => formatCurrency(amount, "KES", "en-KE");
