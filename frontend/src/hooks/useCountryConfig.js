import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { getCountryConfig } from "@/utils/countryConfig";

export function useCountryConfig() {
  const userCountry  = useAuthStore((s) => s.user?.country);
  const guestCountry = useUIStore((s) => s.guestCountry);
  return getCountryConfig(userCountry ?? guestCountry ?? "KE");
}
