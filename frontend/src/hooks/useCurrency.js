import { useCountryConfig } from "@/hooks/useCountryConfig";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatCurrency } from "@/utils/currency";

/**
 * Returns two helpers:
 *   format(amount, from)      — converts from source currency → viewer's currency and formats
 *   formatDirect(amount, cur) — formats without conversion
 *   formatWithSource(amount)  — same but appends "(KES X)" when currency differs
 *
 * Legacy load/bid amounts still default to KES while wallet amounts can pass their own currency.
 */
export function useCurrency() {
  const { currency, locale } = useCountryConfig();
  const { convert } = useExchangeRates();

  const format = (amount, fromCurrency = "KES") => {
    if (amount == null) return `${currency} —`;
    const converted = convert(amount, fromCurrency, currency);
    return formatCurrency(converted, currency, locale);
  };

  const formatDirect = (amount, directCurrency = currency) => {
    if (amount == null) return `${directCurrency} —`;
    return formatCurrency(amount, directCurrency, locale);
  };

  const formatWithSource = (amount) => {
    if (amount == null) return `${currency} —`;
    if (currency === "KES") return formatCurrency(amount, "KES", "en-KE");
    const converted = convert(amount, "KES", currency);
    const primary = formatCurrency(converted, currency, locale);
    const source = formatCurrency(amount, "KES", "en-KE");
    return `${primary} (${source})`;
  };

  return { format, formatDirect, formatWithSource };
}
