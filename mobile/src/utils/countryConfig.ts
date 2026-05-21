import { getCountries, getCountryCallingCode } from "libphonenumber-js";

const REGULATORY_OVERLAY: Record<string, any> = {
  KE: { transportAuthority: "NTSA", revenueAuthority: "KRA", policeService: "Kenya Police Service", dataProtectionLaw: "Kenya Data Protection Act 2019", locale: "en-KE", currency: "KES" },
  UG: { transportAuthority: "UNRA", revenueAuthority: "URA", policeService: "Uganda Police Force", dataProtectionLaw: "Uganda Data Protection & Privacy Act 2019", locale: "en-UG", currency: "UGX" },
  TZ: { transportAuthority: "TRSB", revenueAuthority: "TRA", policeService: "Tanzania Police Force", dataProtectionLaw: "Tanzania Personal Data Protection Act 2022", locale: "en-TZ", currency: "TZS" },
  RW: { transportAuthority: "RURA", revenueAuthority: "RRA", policeService: "Rwanda National Police", dataProtectionLaw: "Rwanda Law No. 058/2021 on Personal Data Protection", locale: "en-RW", currency: "RWF" },
};

const DEFAULTS = {
  transportAuthority: "Transport Authority", revenueAuthority: "Revenue Authority",
  policeService: "Police Service", dataProtectionLaw: "Data Protection Law",
  locale: "en", currency: "USD",
};

const isoToFlag = (code: string) =>
  [...code.toUpperCase()].map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0))).join("");

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export const SUPPORTED_COUNTRIES = getCountries()
  .map((code) => {
    let dialCode: string;
    try { dialCode = `+${getCountryCallingCode(code)}`; } catch { return null; }
    return {
      code, name: displayNames.of(code) ?? code, flag: isoToFlag(code), dialCode,
      ...(REGULATORY_OVERLAY[code] ?? DEFAULTS),
    };
  })
  .filter(Boolean)
  .sort((a: any, b: any) => a.name.localeCompare(b.name)) as any[];

export const COUNTRY_MAP = Object.fromEntries(SUPPORTED_COUNTRIES.map((c) => [c.code, c]));

export const getCountryConfig = (code?: string) =>
  COUNTRY_MAP[code ?? "KE"] ?? COUNTRY_MAP["KE"];

export const buildPhoneNumber = (dialCode: string, localNumber: string) =>
  `${dialCode}${localNumber.replace(/\D/g, "")}`;

export const parsePhoneNumber = (fullPhone: string, countryCode?: string) => {
  const cfg = getCountryConfig(countryCode);
  if (!fullPhone) return { dialCode: cfg.dialCode, localNumber: "" };
  if (fullPhone.startsWith(cfg.dialCode)) {
    return { dialCode: cfg.dialCode, localNumber: fullPhone.slice(cfg.dialCode.length) };
  }
  return { dialCode: cfg.dialCode, localNumber: fullPhone };
};
