import { useState, useRef, useEffect } from "react";
import { Phone, ChevronDown, Search } from "lucide-react";
import {
  SUPPORTED_COUNTRIES,
  getCountryConfig,
  buildPhoneNumber,
  parsePhoneNumber,
} from "@/utils/countryConfig";

export default function PhoneCountryInput({
  value,
  countryCode = "KE",
  onChange,
  required,
  label = "Phone",
}) {
  const cfg = getCountryConfig(countryCode);
  const { localNumber } = parsePhoneNumber(value, countryCode);

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = search.trim()
    ? SUPPORTED_COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dialCode.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase())
      )
    : SUPPORTED_COUNTRIES;

  const handleCountrySelect = (code) => {
    const newCfg = getCountryConfig(code);
    onChange(buildPhoneNumber(newCfg.dialCode, localNumber), code);
    setOpen(false);
    setSearch("");
  };

  const handleLocalChange = (e) => {
    onChange(buildPhoneNumber(cfg.dialCode, e.target.value), countryCode);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {label}
        </label>
      </div>

      <div className="relative flex" ref={dropdownRef}>
        {/* Country selector button */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 pl-3 pr-2 py-3 border border-r-0 border-slate-200 dark:border-slate-600 rounded-l-lg bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 transition-colors shrink-0 focus:outline-none focus:ring-1 focus:ring-secondary focus:border-secondary"
        >
          <span className="text-base leading-none">{cfg.flag}</span>
          <span className="font-medium text-slate-600 text-xs">{cfg.dialCode}</span>
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Local number input */}
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Phone className="w-4 h-4" />
          </div>
          <input
            type="tel"
            value={localNumber}
            onChange={handleLocalChange}
            placeholder={cfg.localNumberPlaceholder ?? "7XX XXX XXX"}
            required={required}
            className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 rounded-r-lg bg-slate-50 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:border-secondary focus:ring-secondary transition-shadow"
          />
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
            {/* Search */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-700">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search country or code…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-secondary focus:border-secondary"
                />
              </div>
            </div>

            {/* Country list */}
            <ul className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-xs text-slate-400">No countries found</li>
              ) : (
                filtered.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => handleCountrySelect(c.code)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                        c.code === countryCode ? "bg-orange-50 dark:bg-orange-900/20 text-secondary font-medium" : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <span className="text-base shrink-0">{c.flag}</span>
                      <span className="flex-1 truncate text-xs">{c.name}</span>
                      <span className="text-xs text-slate-400 shrink-0">{c.dialCode}</span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
