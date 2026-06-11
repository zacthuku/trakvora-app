import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import apiClient from "@/services/apiClient";

const PLACEHOLDER = {
  country: { currency_symbol: "KSh" },
  platform_fees: [
    {
      service_type: "truck",
      shipper_commission_rate: 0.03,
      carrier_commission_rate: 0.07,
      cancellation_fee_rate: 0.05,
      max_commission_kes: 15000,
    },
  ],
};

export function useCountryFees() {
  const userCountry  = useAuthStore((s) => s.user?.country);
  const guestCountry = useUIStore((s) => s.guestCountry);
  const country = userCountry ?? guestCountry ?? "KE";

  const { data } = useQuery({
    queryKey: ["country-fees", country],
    queryFn: () =>
      apiClient
        .get("/settings/country", { params: { code: country } })
        .then((r) => r.data),
    staleTime: 10 * 60 * 1000,
    placeholderData: PLACEHOLDER,
  });

  const fees =
    data?.platform_fees?.find((f) => f.service_type === "truck") ??
    PLACEHOLDER.platform_fees[0];
  const sym = data?.country?.currency_symbol ?? "KSh";

  return {
    currencySymbol: sym,
    shipperCommissionRate: fees.shipper_commission_rate ?? 0.03,
    carrierCommissionRate: fees.carrier_commission_rate ?? 0.07,
    cancellationFeeRate: fees.cancellation_fee_rate ?? 0.05,
    maxCommissionKes: fees.max_commission_kes ?? 15000,
    vatRate: fees.vat_rate ?? 0.16,
    formatPercent: (r) => `${Math.round(r * 100)}%`,
    formatAmount: (v) => `${sym} ${Number(v).toLocaleString()}`,
  };
}
