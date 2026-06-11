import { getCountries, getCountryCallingCode } from "libphonenumber-js";

// ─── Payment methods per country ──────────────────────────────────────────────
// Each entry is an array of { name, color } shown in finance UI and help text.
export const COUNTRY_PAYMENTS = {
  KE: [{ name: "M-Pesa",       color: "text-green-400"   }, { name: "Airtel",        color: "text-red-400"     }, { name: "Banks", color: "text-blue-400" }],
  UG: [{ name: "MTN MoMo",     color: "text-yellow-400"  }, { name: "Airtel",        color: "text-red-400"     }, { name: "Banks", color: "text-blue-400" }],
  TZ: [{ name: "M-Pesa",       color: "text-green-400"   }, { name: "Tigo Pesa",     color: "text-blue-400"    }, { name: "Airtel",color: "text-red-400"  }],
  RW: [{ name: "MTN MoMo",     color: "text-yellow-400"  }, { name: "Airtel",        color: "text-red-400"     }, { name: "Banks", color: "text-blue-400" }],
  BI: [{ name: "Lumicash",     color: "text-orange-400"  }, { name: "Banks",         color: "text-blue-400"    }],
  GH: [{ name: "MTN MoMo",     color: "text-yellow-400"  }, { name: "Vodafone Cash", color: "text-red-400"     }, { name: "Banks", color: "text-blue-400" }],
  NG: [{ name: "Flutterwave",  color: "text-orange-400"  }, { name: "Paystack",      color: "text-blue-400"    }, { name: "Banks", color: "text-slate-400"}],
  ZA: [{ name: "EFT",          color: "text-emerald-400" }, { name: "Ozow",          color: "text-purple-400"  }, { name: "Banks", color: "text-blue-400" }],
  ZM: [{ name: "Airtel",       color: "text-red-400"     }, { name: "MTN MoMo",      color: "text-yellow-400"  }, { name: "Banks", color: "text-blue-400" }],
  ET: [{ name: "Telebirr",     color: "text-green-400"   }, { name: "Banks",         color: "text-blue-400"    }],
  CI: [{ name: "Orange Money", color: "text-orange-400"  }, { name: "MTN MoMo",      color: "text-yellow-400"  }, { name: "Banks", color: "text-blue-400" }],
  SN: [{ name: "Orange Money", color: "text-orange-400"  }, { name: "Wave",          color: "text-blue-400"    }, { name: "Banks", color: "text-slate-400"}],
};
export const DEFAULT_PAYMENTS = [{ name: "Mobile Money", color: "text-yellow-400" }, { name: "Banks", color: "text-blue-400" }];

// ─── Regulatory details for countries active on the platform. ─────────────────
// For all other countries, generic labels ("Transport Authority" etc.) are used.
const REGULATORY_OVERLAY = {
  KE: {
    transportAuthority: "NTSA",
    revenueAuthority: "KRA",
    policeService: "Kenya Police Service",
    dataProtectionLaw: "Kenya Data Protection Act 2019",
    locale: "en-KE",
    currency: "KES",
    jurisdiction:    "Kenya",
    arbitrationCity: "Nairobi",
    arbitrationAct:  "Arbitration Act, Cap. 49 of the Laws of Kenya",
    trafficAct:      "Traffic Act (Cap. 403)",
  },
  UG: {
    transportAuthority: "UNRA",
    revenueAuthority: "URA",
    policeService: "Uganda Police Force",
    dataProtectionLaw: "Uganda Data Protection & Privacy Act 2019",
    locale: "en-UG",
    currency: "UGX",
    jurisdiction:    "Uganda",
    arbitrationCity: "Kampala",
    arbitrationAct:  "Arbitration and Conciliation Act, Cap. 4 of the Laws of Uganda",
    trafficAct:      "Traffic and Road Safety Act, Cap. 361",
  },
  TZ: {
    transportAuthority: "TRSB",
    revenueAuthority: "TRA",
    policeService: "Tanzania Police Force",
    dataProtectionLaw: "Tanzania Personal Data Protection Act 2022",
    locale: "en-TZ",
    currency: "TZS",
    jurisdiction:    "Tanzania",
    arbitrationCity: "Dar es Salaam",
    arbitrationAct:  "Arbitration Act, Cap. 15 of the Laws of Tanzania",
    trafficAct:      "Road Traffic Act, Cap. 168",
  },
  RW: {
    transportAuthority: "RURA",
    revenueAuthority: "RRA",
    policeService: "Rwanda National Police",
    dataProtectionLaw: "Rwanda Law No. 058/2021 on Personal Data Protection",
    locale: "en-RW",
    currency: "RWF",
    jurisdiction:    "Rwanda",
    arbitrationCity: "Kigali",
    arbitrationAct:  "Law No. 005/2021 of 22/04/2021 Governing Arbitration in Rwanda",
    trafficAct:      "Law No. 16/2016 of 20/04/2016 on Road Traffic",
  },
  BI: {
    transportAuthority: "ATRACO",
    revenueAuthority:   "OBR",
    policeService:      "Police Nationale du Burundi",
    dataProtectionLaw:  "Burundi Law on Personal Data Protection",
    locale:             "fr-BI",
    currency:           "BIF",
    jurisdiction:       "Burundi",
    arbitrationCity:    "Bujumbura",
    arbitrationAct:     "applicable arbitration rules",
    trafficAct:         "applicable traffic regulations",
  },
};

const DEFAULTS = {
  transportAuthority: "Transport Authority",
  revenueAuthority: "Revenue Authority",
  policeService: "Police Service",
  dataProtectionLaw: "Data Protection Law",
  locale: "en",
  currency: "USD",
  jurisdiction:    "the applicable jurisdiction",
  arbitrationCity: "a mutually agreed city",
  arbitrationAct:  "applicable arbitration rules",
  trafficAct:      "applicable traffic regulations",
};

const isoToFlag = (code) =>
  [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

export const SUPPORTED_COUNTRIES = getCountries()
  .map((code) => {
    let dialCode;
    try {
      dialCode = `+${getCountryCallingCode(code)}`;
    } catch {
      return null;
    }
    return {
      code,
      name: displayNames.of(code) ?? code,
      flag: isoToFlag(code),
      dialCode,
      ...(REGULATORY_OVERLAY[code] ?? DEFAULTS),
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.name.localeCompare(b.name));

export const COUNTRY_MAP = Object.fromEntries(
  SUPPORTED_COUNTRIES.map((c) => [c.code, c])
);

export const getCountryConfig = (code) => {
  const base = COUNTRY_MAP[code ?? "KE"] ?? COUNTRY_MAP["KE"];
  return { ...base, payments: COUNTRY_PAYMENTS[base.code] ?? DEFAULT_PAYMENTS };
};

export const buildPhoneNumber = (dialCode, localNumber) =>
  `${dialCode}${localNumber.replace(/\D/g, "")}`;

export const parsePhoneNumber = (fullPhone, countryCode) => {
  const cfg = getCountryConfig(countryCode);
  if (!fullPhone) return { dialCode: cfg.dialCode, localNumber: "" };
  if (fullPhone.startsWith(cfg.dialCode)) {
    return {
      dialCode: cfg.dialCode,
      localNumber: fullPhone.slice(cfg.dialCode.length),
    };
  }
  return { dialCode: cfg.dialCode, localNumber: fullPhone };
};
