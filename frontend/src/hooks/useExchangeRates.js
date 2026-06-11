import { useState, useEffect } from "react";
import { getCachedRates, getRates, convertAmount, FALLBACK_RATES } from "@/utils/exchangeRates";

let _rates = getCachedRates() ?? FALLBACK_RATES;
const _listeners = new Set();

// Fetch once for the whole app lifetime, notify all hook instances.
let _fetched = false;
function ensureFetched() {
  if (_fetched) return;
  _fetched = true;
  getRates().then((rates) => {
    _rates = rates;
    _listeners.forEach((fn) => fn(rates));
  });
}

export function useExchangeRates() {
  const [rates, setRates] = useState(_rates);

  useEffect(() => {
    _listeners.add(setRates);
    ensureFetched();
    return () => _listeners.delete(setRates);
  }, []);

  return {
    rates,
    convert: (amount, from = "KES", to = "KES") => convertAmount(amount, from, to, rates),
  };
}
