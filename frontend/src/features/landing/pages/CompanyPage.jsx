import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MapPin, Package, Truck, FileCheck,
  Eye, Shield, Zap, Globe,
  Mail, Linkedin, Twitter, Loader2,
} from "lucide-react";
import apiClient from "@/services/apiClient";
import { mediaUrl } from "@/utils/mediaUrl";
import { feedbackApi } from "@/api/feedbackApi";

// ── Static product/values content (rarely changes; admin can request edit separately) ──
const WHAT_WE_BUILD_BASE = [
  {
    icon: Package,
    title: "Freight Marketplace",
    desc: "Shippers post loads and receive competitive bids from verified carriers within minutes. Shippers and carriers settle payment directly — Trakvora handles the match, compliance, and tracking.",
  },
  {
    icon: Truck,
    title: "Fleet Operating System",
    desc: "Fleet owners manage their vehicles, drivers, compliance documents, and GPS tracking from one dashboard — built for African road conditions.",
  },
];

// Per-country regulatory authority mapping for the compliance card
const REGULATORS = {
  KE: { tax: "KRA",  transport: "NTSA"     },
  UG: { tax: "URA",  transport: "UNRA"     },
  TZ: { tax: "TRA",  transport: "TANROADS" },
  RW: { tax: "RRA",  transport: "RTDA"     },
  ET: { tax: "ERCA", transport: "ETCA"     },
};

function buildComplianceCard(countries) {
  const taxBodies = countries
    .map((c) => REGULATORS[c.country_code]?.tax)
    .filter(Boolean);

  const taxList = taxBodies.length
    ? taxBodies.join(" / ") + "-compliant"
    : "locally compliant";

  return {
    icon: FileCheck,
    title: "Compliance & eTIMS",
    desc: `Auto-generates ${taxList} tax invoices and transport consignment notes — giving you audit-ready records per jurisdiction. Trakvora provides the tools; you remain responsible for filing. We do not act as a tax agent, and we do not facilitate the movement of illegal or prohibited goods.`,
  };
}

const VALUES = [
  { icon: Eye,    title: "Transparency", desc: "Every price, every bid, every tracking point is visible to everyone in the transaction." },
  { icon: Shield, title: "Reliability",  desc: "Verified carriers, real-time alerts, and digital documentation so every shipment arrives as promised." },
  { icon: Zap,    title: "Speed",        desc: "From load posting to matched carrier in under 5 minutes. No phone calls, no middlemen." },
  { icon: Globe,  title: "Local-first",  desc: "Built in Nairobi, for East African roads, regulations, and business realities." },
];

// Derive initials from name
function initials(name = "") {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "?";
}

// Compute flag emoji from ISO-2 country code (pure JS, no library)
function flagEmoji(code = "") {
  return code.toUpperCase().split("").map(
    (c) => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))
  ).join("");
}

// Department groupings — order controls display order on page
const DEPT_GROUPS = [
  { key: "super_admin",        label: "Leadership"       },
  { key: "operations_admin",   label: "Operations"       },
  { key: "iot_technician",     label: "Technology"       },
  { key: "field_inspector",    label: "Field Operations" },
  { key: "compliance_officer", label: "Compliance"       },
  { key: "support_agent",      label: "Support"          },
];

const ROLE_LABEL = {
  super_admin:        "Super Admin",
  operations_admin:   "Operations Admin",
  iot_technician:     "IoT Technician",
  field_inspector:    "Field Inspector",
  compliance_officer: "Compliance Officer",
  support_agent:      "Support Agent",
};

export default function CompanyPage() {
  const [profile,       setProfile]       = useState(null);
  const [team,          setTeam]          = useState([]);
  const [computedStats, setComputedStats] = useState(null);
  const [countries,     setCountries]     = useState([]);
  const [testimonials,  setTestimonials]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(false);

  useEffect(() => {
    apiClient.get("/settings/company-profile")
      .then((r) => {
        setProfile(r.data.profile);
        setTeam(r.data.team ?? []);
        setComputedStats(r.data.computed_stats ?? null);
        setCountries(r.data.countries ?? []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    feedbackApi.listTestimonials()
      .then(setTestimonials)
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }

  // Graceful fallback values if DB row missing
  const p = profile ?? {
    tagline:                  "Built to move Africa's freight.",
    subtitle:                 "Trakvora is the operating system for freight in East Africa.",
    hq_city:                  "Nairobi, Kenya",
    founded_year:             2026,
    mission_headline:         "Digitise freight so every cargo move is fast, fair, and traceable.",
    mission_body:             "",
    show_stats_section:       false,
    show_testimonials_section: false,
  };

  // Format a real count into a display string (e.g. 3247 → "3k+", 8 → "8+")
  const fmt = (n) => n == null ? "—" : n > 999 ? `${Math.floor(n / 1000)}k+` : `${n}+`;

  const cs = computedStats;
  const stats = [
    { value: fmt(cs?.carriers),  label: "Verified carriers"   },
    { value: fmt(cs?.countries), label: "Countries"           },
    { value: fmt(cs?.shipments), label: "Shipments processed" },
    { value: String(p.founded_year), label: "Founded"         },
  ];

  const showStats        = p.show_stats_section        && (cs?.carriers ?? 0) >= 100;
  const showTestimonials = p.show_testimonials_section && testimonials.length > 0;

  const whatWeBuild = [...WHAT_WE_BUILD_BASE, buildComplianceCard(countries)];

  return (
    <div className="bg-white">

      {/* ── Hero ── */}
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-[#fe6a34]/40 bg-[#fe6a34]/10 px-4 py-1.5 rounded-full mb-6">
            <MapPin className="w-3.5 h-3.5 text-[#fe6a34]" />
            <span className="text-xs font-bold font-heading text-[#fe6a34] uppercase tracking-widest">
              {p.hq_city}
            </span>
          </div>
          <h1 className="font-heading text-4xl md:text-6xl font-extrabold mb-5 tracking-tight leading-tight">
            {p.tagline.includes("Africa") ? (
              <>
                {p.tagline.split("Africa")[0]}
                <span className="text-[#fe6a34]">Africa</span>
                {p.tagline.split("Africa")[1]}
              </>
            ) : (
              <span className="text-[#fe6a34]">{p.tagline}</span>
            )}
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto leading-relaxed">{p.subtitle}</p>
        </div>
      </section>

      {/* ── Stats strip — hidden until admin enables + 100+ carriers ── */}
      {showStats && (
        <section className="bg-[#fe6a34] py-10 px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
            {stats.map((s) => (
              <div key={s.label}>
                <p className="font-heading text-3xl font-extrabold leading-tight">{s.value}</p>
                <p className="text-sm font-semibold opacity-80 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Mission ── */}
      <section className="py-14 px-6 bg-white">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-bold font-heading text-[#fe6a34] uppercase tracking-widest mb-3">Our Mission</p>
            <h2 className="font-heading text-3xl font-extrabold text-slate-900 mb-5 leading-snug">
              {p.mission_headline}
            </h2>
            {p.mission_body.split("\n\n").filter(Boolean).map((para, i) => (
              <p key={i} className="text-slate-500 leading-relaxed mb-4">{para}</p>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { heading: "Kenya",    sub: "Primary market"  },
              { heading: "Uganda",   sub: "Active corridor" },
              { heading: "Tanzania", sub: "Active corridor" },
              { heading: "24 / 7",   sub: "Platform uptime" },
            ].map((item) => (
              <div key={item.heading} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                <p className="font-heading text-2xl font-extrabold text-slate-900">{item.heading}</p>
                <p className="text-xs text-slate-500 font-semibold mt-1">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What we build ── */}
      <section className="py-14 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold font-heading text-[#fe6a34] uppercase tracking-widest mb-3">The Platform</p>
            <h2 className="font-heading text-3xl font-extrabold text-slate-900">What we build</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {whatWeBuild.map((item) => (
              <div key={item.title} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                <div className="w-11 h-11 rounded-xl bg-[#fe6a34]/10 flex items-center justify-center mb-4">
                  <item.icon className="w-5 h-5 text-[#fe6a34]" />
                </div>
                <h3 className="font-heading font-bold text-slate-900 text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className="py-14 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-bold font-heading text-[#fe6a34] uppercase tracking-widest mb-3">What drives us</p>
            <h2 className="font-heading text-3xl font-extrabold text-slate-900">Our values</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#fe6a34]/10 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="w-5 h-5 text-[#fe6a34]" />
                </div>
                <h3 className="font-heading font-bold text-slate-900 mb-2">{v.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials — hidden until admin enables + at least 1 exists ── */}
      {showTestimonials && (
        <section className="py-14 px-6 bg-[#f3f8ff]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold font-heading text-[#fe6a34] uppercase tracking-widest mb-3">What customers say</p>
              <h2 className="font-heading text-3xl font-extrabold text-slate-900 mb-2">Loved by businesses across Africa</h2>
              <p className="text-slate-500">Real results from real customers</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <div key={t.id} className="bg-white rounded-2xl p-7 border border-[#9FC2C9]">
                  <div className="w-10 h-10 bg-[#9FC2C9]/30 rounded-xl flex items-center justify-center mb-5">
                    <span className="text-xs font-black text-[#000D47]">
                      {(t.company_name ?? t.name).slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed mb-6 italic">"{t.message}"</p>
                  <div className="border-t border-[#9FC2C9]/50 pt-4">
                    <div className="text-gray-900 font-semibold text-sm">{t.name}</div>
                    {(t.role || t.company_name) && (
                      <div className="text-gray-500 text-xs mt-0.5">
                        {[t.role, t.company_name].filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Where we operate (Countries) ── */}
      {countries.length > 0 && (
        <section className="py-14 px-6 bg-[#f3f8ff] text-gray-900">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-xs font-bold font-heading text-[#fe6a34] uppercase tracking-widest mb-3">Where we operate</p>
              <h2 className="font-heading text-3xl font-extrabold text-gray-900">Our markets</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {countries.map((c) => (
                <div key={c.country_code} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:border-gray-300 transition-colors shadow-sm">
                  <span className="text-3xl leading-none select-none">{flagEmoji(c.country_code)}</span>
                  <div className="min-w-0">
                    <p className="font-heading font-bold text-gray-900 text-sm leading-tight truncate">{c.country_name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.currency_code} · {c.phone_prefix}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Team — only shown when at least one admin is marked visible ── */}
      {!error && team.length > 0 && (
        <section className="py-14 px-6 bg-white text-gray-900">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-20">
              <p className="text-xs font-bold font-heading text-[#fe6a34] uppercase tracking-[0.18em] mb-3">The team</p>
              <h2 className="font-heading text-4xl font-extrabold tracking-tight text-gray-900">Who's building this</h2>
              <p className="text-gray-500 text-base mt-4 max-w-lg mx-auto">
                The people behind Trakvora's mission to digitise freight across Africa.
              </p>
            </div>

            <div className="space-y-16">
                {/* Render each department group that has members */}
                {[...DEPT_GROUPS, { key: "__other__", label: "Team" }].map(({ key, label }) => {
                  const known = new Set(DEPT_GROUPS.map((g) => g.key));
                  const members = key === "__other__"
                    ? team.filter((m) => !known.has(m.admin_role))
                    : team.filter((m) => m.admin_role === key);
                  if (!members.length) return null;

                  return (
                    <div key={key}>
                      {/* Department label — no border/line */}
                      <p className="text-[11px] font-heading font-bold uppercase tracking-[0.18em] text-[#fe6a34] mb-8">
                        {label}
                      </p>

                      {/* Members list — no dividers, space via gap */}
                      <div className="space-y-10">
                        {members.map((m) => (
                          <div key={m.id} className="flex items-start gap-6">
                            {/* Avatar — 80 × 80 */}
                            {m.profile_photo_url ? (
                              <img
                                src={mediaUrl(m.profile_photo_url)}
                                alt={m.full_name}
                                className="w-20 h-20 rounded-2xl object-cover shrink-0 ring-1 ring-gray-200"
                              />
                            ) : (
                              <div className="w-20 h-20 rounded-2xl bg-[#fe6a34]/15 ring-1 ring-[#fe6a34]/25 flex items-center justify-center shrink-0">
                                <span className="font-heading font-extrabold text-[#fe6a34] text-2xl">
                                  {initials(m.full_name)}
                                </span>
                              </div>
                            )}

                            {/* Text block */}
                            <div className="flex-1 min-w-0 pt-1">
                              <p className="font-heading font-extrabold text-gray-900 text-xl leading-tight tracking-tight">
                                {m.full_name}
                              </p>
                              <p className="text-[#fe6a34] text-sm font-semibold mt-1">
                                {m.job_title ?? ROLE_LABEL[m.admin_role] ?? "Team Member"}
                              </p>
                              {m.bio && (
                                <p className="text-gray-600 text-sm leading-relaxed mt-3 max-w-prose">
                                  {m.bio}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-14 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-3xl font-extrabold text-slate-900 mb-4">
            Ready to move freight smarter?
          </h2>
          <p className="text-slate-500 mb-8">
            Join thousands of shippers, fleet owners, and drivers already on Trakvora.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register"
              className="bg-[#fe6a34] text-white font-bold font-heading px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity uppercase tracking-wide text-sm">
              Get Started Free
            </Link>
            <Link to="/help#contact"
              className="border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-8 py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm">
              Contact Us
            </Link>
          </div>
          <p className="mt-10 text-xs text-slate-400">
            Trakvora is a product of{" "}
            <span className="font-semibold text-slate-500">Intellora Solutions Limited</span>
          </p>
        </div>
      </section>

    </div>
  );
}
