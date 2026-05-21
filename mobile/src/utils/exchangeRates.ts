import AsyncStorage from "@react-native-async-storage/async-storage";

export const FALLBACK_RATES: Record<string, number> = {
  KES: 1, UGX: 28.5, TZS: 20.1, RWF: 10.3,
  USD: 0.0077, EUR: 0.0071, GBP: 0.0061,
};

export const CURRENCY_META: Record<string, { symbol: string; label: string }> = {
  KES: { symbol: "KSh", label: "Kenyan Shilling" },
  UGX: { symbol: "USh", label: "Ugandan Shilling" },
  TZS: { symbol: "TSh", label: "Tanzanian Shilling" },
  RWF: { symbol: "RF",  label: "Rwandan Franc" },
  USD: { symbol: "$",   label: "US Dollar" },
  EUR: { symbol: "€",   label: "Euro" },
  GBP: { symbol: "£",   label: "British Pound" },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_META);

const CACHE_KEY = "trakvora_fx_rates";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function getCachedRates(): Promise<Record<string, number> | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { rates, ts } = JSON.parse(raw);
    return Date.now() - ts < CACHE_TTL_MS ? rates : null;
  } catch {
    return null;
  }
}

async function setCachedRates(rates: Record<string, number>) {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }));
  } catch {
    // ignore storage quota errors
  }
}

async function fetchLiveRates(): Promise<Record<string, number>> {
  const res = await fetch("https://open.er-api.com/v6/latest/KES");
  if (!res.ok) throw new Error(`Rate fetch failed: ${res.status}`);
  const { rates } = await res.json();
  const full = { KES: 1, ...rates };
  await setCachedRates(full);
  return full;
}

let _pending: Promise<Record<string, number>> | null = null;

export async function getRates(): Promise<Record<string, number>> {
  const cached = await getCachedRates();
  if (cached) return cached;

  if (!_pending) {
    _pending = fetchLiveRates()
      .catch(() => FALLBACK_RATES)
      .finally(() => { _pending = null; });
  }
  return _pending;
}

export function convertAmount(
  amount: number, from: string, to: string,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  const kesAmount = amount / (rates[from] ?? 1);
  return kesAmount * (rates[to] ?? 1);
}
