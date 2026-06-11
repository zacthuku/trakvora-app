import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import { COUNTRY_MAP } from "@/utils/countryConfig";

const FALLBACK_CODES = ["KE", "UG", "TZ", "RW"];

export default function CountrySelector({ value = "KE", onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const current = COUNTRY_MAP[value] ?? COUNTRY_MAP["KE"];

  const { data } = useQuery({
    queryKey: ["active-countries"],
    queryFn: () =>
      apiClient.get("/settings/company-profile").then((r) => r.data.countries ?? []),
    staleTime: 30 * 60 * 1000,
  });

  const rawCodes = data?.length ? data : FALLBACK_CODES.map((c) => ({ country_code: c }));
  const countries = [...new Map(rawCodes.map((c) => [c.country_code, c])).values()]
    .map((c) => COUNTRY_MAP[c.country_code])
    .filter(Boolean);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") setOpen(false);
  };

  const handleSelect = (code) => {
    onChange?.(code);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        title="Select country"
        aria-label={`Country: ${current.name}`}
      >
        <span className="text-base leading-none">{current.flag}</span>
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${
            open ? "rotate-180 text-orange-400" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-2xl z-[60] overflow-hidden py-1">
          {countries.map((c) => (
            <CountryRow key={c.code} country={c} active={c.code === value} onSelect={handleSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function CountryRow({ country, active, onSelect }) {
  return (
    <button
      onClick={() => onSelect(country.code)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        active ? "bg-orange-50 text-orange-600" : "hover:bg-gray-50 text-gray-800"
      }`}
    >
      <span className="text-base leading-none shrink-0">{country.flag}</span>
      <span className="flex-1 text-sm font-medium truncate">{country.name}</span>
      <span className={`text-xs font-semibold shrink-0 ${active ? "text-orange-400" : "text-gray-400"}`}>
        {country.code}
      </span>
    </button>
  );
}
