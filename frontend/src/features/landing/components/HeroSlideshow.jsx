import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, LayoutDashboard, Package, Truck, ShoppingBag, CreditCard,
  FileCheck, BarChart2, CheckCircle, Globe, CheckCircle2,
  Clock, MapPin, AlertTriangle, Banknote,
} from "lucide-react";
import { LogoFull } from "@/components/ui/Logo";
import apiClient from "@/services/apiClient";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { DEFAULT_PAYMENTS } from "@/utils/countryConfig";

const AUTO_MS   = 5000;
const RESUME_MS = 6000;

// ─── Dashboard Mockup ─────────────────────────────────────────────────────────
function DashboardMockup() {
  return (
    <div className="bg-[#0d1117] rounded-2xl overflow-hidden shadow-2xl border border-white/10 text-white text-xs select-none">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <LogoFull iconSize={16} variant="dark" />
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[9px]">May 12 – May 18, 2024</span>
          <Bell className="w-3 h-3 text-slate-400" />
          <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[8px] font-bold">JK</div>
          <span className="text-[9px] text-slate-300">John Kamau</span>
          <span className="text-[8px] text-slate-500">Admin</span>
        </div>
      </div>

      <div className="flex">
        <div className="w-[100px] border-r border-white/10 py-2 shrink-0">
          {[
            { icon: LayoutDashboard, label: "Overview",    active: true },
            { icon: Package,         label: "Shipments"               },
            { icon: Truck,           label: "Fleet"                   },
            { icon: ShoppingBag,     label: "Marketplace"             },
            { icon: CreditCard,      label: "Finance"                 },
            { icon: FileCheck,       label: "Compliance"              },
            { icon: BarChart2,       label: "Analytics"               },
          ].map(({ icon: Icon, label, active }) => (
            <div key={label} className={`flex items-center gap-2 px-3 py-[7px] text-[9px] font-medium ${active ? "text-orange-400 bg-orange-500/10 border-l-2 border-orange-500" : "text-slate-500"}`}>
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>

        <div className="flex-1 p-3 space-y-2 min-w-0">
          <div className="text-sm font-bold">Overview</div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "Total Shipments",  val: "1,248", change: "↑ 18.6%" },
              { label: "In Transit",       val: "782",   change: "↑ 12.4%" },
              { label: "Delivered",        val: "466",   change: "↑ 23.1%" },
              { label: "On-time Delivery", val: "99.2%", change: "↑ 5.3%"  },
            ].map(({ label, val, change }) => (
              <div key={label} className="bg-white/[0.06] rounded-lg p-1.5">
                <div className="text-[7px] text-slate-400 leading-tight truncate">{label}</div>
                <div className="text-[11px] font-bold mt-0.5">{val}</div>
                <div className="text-[7px] text-emerald-400 font-semibold">{change}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            <div className="col-span-3 bg-white/[0.06] rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-semibold">Live Shipment Map</span>
                <span className="text-[7px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">All Status ▾</span>
              </div>
              <div className="relative h-[84px] bg-slate-800/60 rounded overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 130 84" preserveAspectRatio="xMidYMid meet">
                  <path d="M42,6 Q58,2 68,11 Q78,20 80,33 Q82,48 76,62 Q70,76 60,80 Q50,84 42,77 Q32,70 27,57 Q22,44 25,30 Q28,16 42,6Z"
                    fill="none" stroke="#334155" strokeWidth="0.8"/>
                  <circle cx="53" cy="36" r="2.5" fill="#fe6a34" opacity="0.9"/>
                  <circle cx="62" cy="42" r="2.5" fill="#fe6a34" opacity="0.9"/>
                  <circle cx="66" cy="57" r="2.5" fill="#fe6a34" opacity="0.9"/>
                  <circle cx="44" cy="40" r="2.5" fill="#fe6a34" opacity="0.9"/>
                  <line x1="44" y1="40" x2="53" y2="36" stroke="#fe6a34" strokeWidth="0.8" strokeDasharray="2,1.5" opacity="0.6"/>
                  <line x1="53" y1="36" x2="62" y2="42" stroke="#fe6a34" strokeWidth="0.8" strokeDasharray="2,1.5" opacity="0.6"/>
                  <line x1="62" y1="42" x2="66" y2="57" stroke="#fe6a34" strokeWidth="0.8" strokeDasharray="2,1.5" opacity="0.6"/>
                  <text x="30" y="39" fontSize="4.5" fill="#94a3b8">Kampala</text>
                  <text x="54" y="33" fontSize="4.5" fill="#94a3b8">Nairobi</text>
                  <text x="63" y="40" fontSize="4.5" fill="#94a3b8">Mombasa</text>
                  <text x="52" y="64" fontSize="4.5" fill="#94a3b8">Dar es Salaam</text>
                </svg>
              </div>
            </div>

            <div className="col-span-2 bg-white/[0.06] rounded-lg p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[9px] font-semibold">Recent Shipments</span>
                <span className="text-[7px] text-orange-400">View all</span>
              </div>
              <div className="space-y-2">
                {[
                  { route: "NBI → KLA", id: "KBC 123A", status: "In Transit", eta: "1h 45m" },
                  { route: "MBA → DAR", id: "TZA 567B", status: "In Transit", eta: "2h 30m" },
                  { route: "DAR → JNB", id: "ZAF 345C", status: "Delivered",  eta: "2h ago" },
                  { route: "KLA → NBI", id: "UAG 789D", status: "In Transit", eta: "3h 15m" },
                ].map(({ route, id, status, eta }) => (
                  <div key={id} className="flex items-start justify-between">
                    <div>
                      <div className="text-[9px] font-bold leading-tight">{route}</div>
                      <div className="text-[7px] text-slate-500">{id}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-[7px] font-semibold ${status === "Delivered" ? "text-emerald-400" : "text-blue-400"}`}>{status}</div>
                      <div className="text-[7px] text-slate-500">ETA: {eta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            <div className="col-span-3 bg-white/[0.06] rounded-lg p-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-semibold">Revenue Overview</span>
                <span className="text-[7px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">This Week ▾</span>
              </div>
              <div className="text-xs font-bold text-orange-400">
                KES 58.4M <span className="text-[8px] text-emerald-400 font-semibold ml-1">↑ 16.7%</span>
              </div>
              <div className="h-9 flex items-end gap-[2px] mt-1.5">
                {[18, 32, 24, 42, 28, 52, 68, 80].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 7 ? "#fe6a34" : "rgba(254,106,52,0.3)" }} />
                ))}
              </div>
            </div>

            <div className="col-span-2 bg-white/[0.06] rounded-lg p-2">
              <div className="text-[9px] font-semibold mb-1.5">Payments</div>
              <div className="relative w-14 h-14 mx-auto">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  <circle cx="18" cy="18" r="13" fill="none" stroke="#1e293b" strokeWidth="5"/>
                  <circle cx="18" cy="18" r="13" fill="none" stroke="#3b82f6" strokeWidth="5" strokeDasharray="55 100" strokeDashoffset="0"/>
                  <circle cx="18" cy="18" r="13" fill="none" stroke="#f59e0b" strokeWidth="5" strokeDasharray="22 100" strokeDashoffset="-55"/>
                  <circle cx="18" cy="18" r="13" fill="none" stroke="#ef4444" strokeWidth="5" strokeDasharray="11 100" strokeDashoffset="-77"/>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
                  <div className="text-[7px] font-bold">KES</div>
                  <div className="text-[7px] font-bold">58.4M</div>
                  <div className="text-[6px] text-slate-400">Total</div>
                </div>
              </div>
              <div className="space-y-0.5 mt-1.5">
                {[
                  { c: "bg-blue-500",  l: "Paid",    p: "63%" },
                  { c: "bg-amber-500", l: "Pending", p: "25%" },
                  { c: "bg-red-500",   l: "Overdue", p: "12%" },
                ].map(({ c, l, p }) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${c}`}/>
                    <span className="text-[7px] text-slate-400 flex-1">{l}</span>
                    <span className="text-[7px] font-bold">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile App Mockup ────────────────────────────────────────────────────────
function MobileAppMockup() {
  return (
    <div className="relative w-[220px] mx-auto">
      <div className="bg-[#0d1117] rounded-[36px] border-[2px] border-white/20 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-2 text-[10px] text-white/50">
          <span>9:41</span>
          <div className="w-14 h-3.5 bg-black rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-1.5"/>
          <span>▮▮▮</span>
        </div>
        <div className="px-4 pb-5 pt-2 space-y-3">
          <div className="text-[11px] font-bold text-orange-400 bg-orange-500/15 border border-orange-500/30 rounded-full px-2.5 py-0.5 inline-block">
            ● Current Job
          </div>
          <div className="bg-white/8 rounded-xl p-3 space-y-1.5">
            <div className="text-[12px] font-bold text-white">Kampala → Nairobi</div>
            <div className="text-[9px] text-slate-400">KBC 123A · 20 Tons · In Transit</div>
            <div className="flex gap-3 text-[9px] text-slate-300 mt-1">
              <span>⏱ 1h 45m</span>
              <span>📍 320 km</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[8px] text-slate-400">
              <span>Picked Up</span><span>In Transit</span><span>Delivered</span>
            </div>
            <div className="relative h-1.5 bg-white/10 rounded-full">
              <div className="absolute left-0 top-0 h-full w-2/3 bg-orange-500 rounded-full"/>
            </div>
          </div>
          <div className="bg-white/8 rounded-xl p-3">
            <div className="text-[9px] text-slate-400 mb-1.5">Delivery Documents</div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] text-white font-medium">📄 POD_123A.pdf</span>
              <span className="text-[8px] text-emerald-400 font-bold">Uploaded</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[8px] text-slate-400">Earnings</div>
              <div className="text-[13px] font-bold text-white">KES 24,500</div>
            </div>
            <button className="text-[9px] text-orange-400 font-semibold bg-orange-500/15 px-2.5 py-1 rounded-lg border border-orange-500/30">
              View details
            </button>
          </div>
          <div className="flex justify-around pt-1 border-t border-white/10">
            {["🏠", "🗺️", "💼", "💬"].map((icon, i) => (
              <span key={i} className="text-[14px]">{icon}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -inset-4 bg-orange-500/10 rounded-full blur-3xl -z-10"/>
    </div>
  );
}

// ─── Fleet Mockup ─────────────────────────────────────────────────────────────
function FleetMockup() {
  return (
    <div className="bg-[#0d1117] rounded-2xl overflow-hidden shadow-2xl border border-white/10 text-white text-xs select-none">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-orange-400"/>
          <span className="text-[11px] font-bold text-white">Fleet Management</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-slate-500">Live</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"/>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Active",      val: "1,248", color: "text-emerald-400" },
            { label: "Idle",        val: "312",   color: "text-amber-400"   },
            { label: "Maintenance", val: "47",    color: "text-red-400"     },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-white/[0.06] rounded-lg p-2 text-center">
              <div className={`text-[13px] font-bold ${color}`}>{val}</div>
              <div className="text-[7px] text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white/[0.06] rounded-lg overflow-hidden">
          <div className="grid grid-cols-3 px-2.5 py-1.5 border-b border-white/10">
            <span className="text-[8px] font-semibold text-slate-400">Truck</span>
            <span className="text-[8px] font-semibold text-slate-400 text-center">Route</span>
            <span className="text-[8px] font-semibold text-slate-400 text-right">Status</span>
          </div>
          {[
            { id: "KBC 123A", driver: "J. Kamau",  route: "NBI → KLA", status: "In Transit", sc: "text-blue-400"  },
            { id: "TZA 567B", driver: "A. Owino",  route: "MBA → DAR", status: "In Transit", sc: "text-blue-400"  },
            { id: "ZAF 345C", driver: "P. Mwangi", route: "–",         status: "Idle",       sc: "text-amber-400" },
            { id: "UAG 789D", driver: "S. Kimani", route: "KLA → NBI", status: "Alert",      sc: "text-red-400"   },
          ].map(({ id, driver, route, status, sc }) => (
            <div key={id} className="grid grid-cols-3 items-center px-2.5 py-2 border-b border-white/5 last:border-0">
              <div>
                <div className="text-[9px] font-bold">{id}</div>
                <div className="text-[7px] text-slate-500">{driver}</div>
              </div>
              <div className="text-[8px] text-slate-400 text-center">{route}</div>
              <div className={`text-[8px] font-semibold text-right ${sc}`}>{status}</div>
            </div>
          ))}
        </div>

        <div className="bg-white/[0.06] rounded-lg p-2.5">
          <div className="flex justify-between text-[8px] text-slate-400 mb-1.5">
            <span>Fleet Utilization</span>
            <span className="text-emerald-400 font-bold">81%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-[81%] bg-gradient-to-r from-orange-500 to-emerald-400 rounded-full"/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Finance Mockup ───────────────────────────────────────────────────────────
function FinanceMockup({ payments = DEFAULT_PAYMENTS, currency = "KES" }) {
  const invoices = [
    { inv: "INV-2847", shipper: "Bidco Africa", amount: `${currency} 142K`, status: "Paid",    sc: "text-emerald-400" },
    { inv: "INV-2846", shipper: "Crown Foods",  amount: `${currency} 89K`,  status: "Pending", sc: "text-amber-400"   },
    { inv: "INV-2845", shipper: "Air Liquide",  amount: `${currency} 215K`, status: "Paid",    sc: "text-emerald-400" },
  ];

  return (
    <div className="bg-[#0d1117] rounded-2xl overflow-hidden shadow-2xl border border-white/10 text-white text-xs select-none">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Banknote className="w-3.5 h-3.5 text-orange-400"/>
          <span className="text-[11px] font-bold text-white">Finance & Billing</span>
        </div>
        <span className="text-[8px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">This Month ▾</span>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="bg-white/[0.06] rounded-lg p-3">
          <div className="text-[8px] text-slate-400 mb-1">Total Revenue</div>
          <div className="text-xl font-bold text-orange-400">{currency} 58.4M</div>
          <div className="text-[9px] text-emerald-400 font-semibold">↑ 16.7% vs last month</div>
          <div className="h-9 flex items-end gap-[3px] mt-3">
            {[18, 32, 24, 42, 28, 52, 68, 80].map((h, i) => (
              <div key={i} className="flex-1 rounded-t"
                style={{ height: `${h}%`, background: i === 7 ? "#fe6a34" : "rgba(254,106,52,0.3)" }}/>
            ))}
          </div>
        </div>

        <div className="bg-white/[0.06] rounded-lg overflow-hidden">
          <div className="px-2.5 py-1.5 border-b border-white/10 text-[8px] font-semibold text-slate-300">
            Recent Invoices
          </div>
          {invoices.map(({ inv, shipper, amount, status, sc }) => (
            <div key={inv} className="flex items-center justify-between px-2.5 py-2 border-b border-white/5 last:border-0">
              <div>
                <div className="text-[9px] font-bold">{inv}</div>
                <div className="text-[7px] text-slate-500">{shipper}</div>
              </div>
              <div className="text-[9px] text-white font-semibold">{amount}</div>
              <div className={`text-[8px] font-bold ${sc}`}>{status}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 bg-white/[0.06] rounded-lg px-2.5 py-2">
          <span className="text-[7px] text-slate-400 shrink-0">Pay via</span>
          {payments.map(({ name, color }) => (
            <span key={name} className={`text-[8px] font-bold ${color} bg-white/5 px-1.5 py-0.5 rounded`}>{name}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Control Tower Mockup ─────────────────────────────────────────────────────
function ControlTowerMockup() {
  return (
    <div className="bg-[#0d1117] rounded-2xl overflow-hidden shadow-2xl border border-white/10 text-white text-xs select-none">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-orange-400"/>
          <span className="text-[11px] font-bold text-white">Live Operations</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
          <span className="text-[8px] text-emerald-400 font-semibold">5 Active</span>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "In Transit", val: "4",   color: "text-blue-400"    },
            { label: "Delivered",  val: "1",   color: "text-emerald-400" },
            { label: "On Time",    val: "94%", color: "text-orange-400"  },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-white/[0.06] rounded-lg p-2 text-center">
              <div className={`text-[13px] font-bold ${color}`}>{val}</div>
              <div className="text-[7px] text-slate-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg overflow-hidden h-[88px]">
          <svg className="w-full h-full" viewBox="0 0 500 192" preserveAspectRatio="xMidYMid slice">
            <rect width="500" height="192" fill="#1e293b"/>
            <path d="M160,22 Q190,8 230,14 Q270,20 300,38 Q330,56 340,85 Q350,114 335,142 Q320,170 295,180 Q270,190 240,185 Q210,180 190,165 Q170,150 158,128 Q146,106 148,80 Q150,54 160,22Z"
              fill="none" stroke="#334155" strokeWidth="1.5"/>
            <line x1="178" y1="95" x2="235" y2="70" stroke="#fe6a34" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7"/>
            <line x1="235" y1="70" x2="275" y2="90" stroke="#fe6a34" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7"/>
            <line x1="275" y1="90" x2="285" y2="135" stroke="#fe6a34" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7"/>
            <circle cx="178" cy="95"  r="5" fill="#fe6a34" opacity="0.9"/>
            <circle cx="235" cy="70"  r="5" fill="#fe6a34" opacity="0.9"/>
            <circle cx="275" cy="90"  r="5" fill="#fe6a34" opacity="0.9"/>
            <circle cx="285" cy="135" r="5" fill="#fe6a34" opacity="0.9"/>
            <circle cx="210" cy="81"  r="7" fill="#fe6a34" stroke="white" strokeWidth="1.5" opacity="0.95"/>
            <text x="152" y="108" fontSize="9" fill="#64748b">Kampala</text>
            <text x="216" y="62"  fontSize="9" fill="#64748b">Nairobi</text>
            <text x="255" y="84"  fontSize="9" fill="#64748b">Mombasa</text>
            <text x="255" y="150" fontSize="9" fill="#64748b">Dar es Salaam</text>
          </svg>
        </div>

        <div className="bg-white/[0.06] rounded-lg overflow-hidden">
          {[
            { route: "NBI → KLA", id: "KBC 123A", status: "In Transit", sc: "text-blue-400",    eta: "1h 45m" },
            { route: "MBA → DAR", id: "TZA 567B", status: "In Transit", sc: "text-blue-400",    eta: "2h 30m" },
            { route: "DAR → JNB", id: "ZAF 345C", status: "Delivered",  sc: "text-emerald-400", eta: "Done"   },
            { route: "KLA → NBI", id: "UAG 789D", status: "In Transit", sc: "text-blue-400",    eta: "3h 15m" },
          ].map(({ route, id, status, sc, eta }) => (
            <div key={id} className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${status === "Delivered" ? "bg-emerald-400" : "bg-orange-400"}`}/>
                <div>
                  <div className="text-[9px] font-bold leading-tight">{route}</div>
                  <div className="text-[7px] text-slate-500">{id}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-[7px] font-semibold ${sc}`}>{status}</div>
                <div className="text-[7px] text-slate-500">ETA: {eta}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Slides ───────────────────────────────────────────────────────────────────
const SLIDES = [
  {
    badge: "Logistics Hub",
    renderHeadline: () => (
      <>Africa&apos;s Intelligent<br />Logistics{" "}<span style={{ color: "#fe6a34" }}>Operating</span><br />System</>
    ),
    description: "Connect shippers, transporters, drivers, finance and compliance in one platform to move freight smarter, faster and more profitably.",
    Visual: DashboardMockup,
  },
  {
    badge: "Operations",
    renderHeadline: () => (
      <>Live{" "}<span style={{ color: "#fe6a34" }}>Operations</span><br />Control Tower</>
    ),
    description: "Track every active shipment in real time. Geofence alerts, digital proof of delivery, and instant exception notifications — full visibility from pickup to delivery.",
    Visual: ControlTowerMockup,
  },
  {
    badge: "Mobile App",
    renderHeadline: () => (
      <>Everything You Need,<br />Right In Your{" "}<span style={{ color: "#fe6a34" }}>Pocket</span></>
    ),
    description: "Drivers accept jobs, upload PODs and track earnings. Owners monitor fleets. Shippers follow their freight — all from one app.",
    Visual: MobileAppMockup,
  },
  {
    badge: "Fleet Management",
    renderHeadline: () => (
      <>Complete Fleet{" "}<span style={{ color: "#fe6a34" }}>Visibility</span><br />& Control</>
    ),
    description: "Track every truck in real time. Manage maintenance schedules, driver assignments and performance metrics in one place.",
    Visual: FleetMockup,
  },
  {
    badge: "Finance & Billing",
    renderHeadline: () => (
      <>Commission &amp; Billing,<br /><span style={{ color: "#fe6a34" }}>Automated</span></>
    ),
    description: "Every completed job triggers an automatic commission invoice — VAT included. Full audit trails and optional managed payments, all handled without manual work.",
    Visual: FinanceMockup,
  },
];

// Map image_type string → Visual component (for API-sourced slides)
const VISUAL_MAP = {
  dispatch_os:   DashboardMockup,
  control_tower: ControlTowerMockup,
  mobile_app:    MobileAppMockup,
  fleet_mgmt:    FleetMockup,
  finance:       FinanceMockup,
};

// Human-readable badge labels for API slides (avoids "Dispatch Os" auto-generation)
const BADGE_NAMES = {
  dispatch_os:   "Logistics Hub",
  control_tower: "Operations",
  mobile_app:    "Mobile App",
  fleet_mgmt:    "Fleet Management",
  finance:       "Finance & Billing",
};

function makeRenderHeadline(headline, highlightWord) {
  if (!highlightWord) return () => headline;
  const parts = headline.split(highlightWord);
  // eslint-disable-next-line react/display-name
  return () => (
    <>
      {parts[0]}
      <span style={{ color: "#fe6a34" }}>{highlightWord}</span>
      {parts[1] || ""}
    </>
  );
}

function apiSlidesToSlides(apiSlides) {
  return apiSlides.map(s => ({
    badge:         BADGE_NAMES[s.image_type] || s.image_type?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Trakvora",
    renderHeadline: makeRenderHeadline(s.headline, s.highlight_word),
    description:   s.description,
    Visual:        VISUAL_MAP[s.image_type] || DashboardMockup,
    cta_primary_text:   s.cta_primary_text,
    cta_primary_url:    s.cta_primary_url,
    cta_secondary_text: s.cta_secondary_text,
    cta_secondary_url:  s.cta_secondary_url,
  }));
}

// ─── HeroSlideshow ────────────────────────────────────────────────────────────
export default function HeroSlideshow({ user, dashboardTo, stats }) {
  const { code: countryCode, currency: countryCurrency, payments: countryPayments } = useCountryConfig();

  // Fetch dynamic slides from API — falls back to hardcoded SLIDES if empty
  const { data: apiSlides } = useQuery({
    queryKey: ["hero-slides", countryCode],
    queryFn:  () => apiClient.get("/settings/hero-slides", { params: { country: countryCode } }).then(r => r.data),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const slides = (apiSlides && apiSlides.length > 0) ? apiSlidesToSlides(apiSlides) : SLIDES;

  const [active, setActive]   = useState(0);
  const [fading, setFading]   = useState(false);
  const autoRef               = useRef(null);
  const inactivityRef         = useRef(null);
  const activeRef             = useRef(0);

  // Reset to first slide when slides source changes (country switch)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setActive(0); activeRef.current = 0; }, [slides.length]);

  const goToSlide = useCallback((idx) => {
    setFading(true);
    setTimeout(() => {
      setActive(idx);
      activeRef.current = idx;
      setFading(false);
    }, 300);
  }, []);

  const startAuto = useCallback((len) => {
    clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      const next = (activeRef.current + 1) % len;
      goToSlide(next);
    }, AUTO_MS);
  }, [goToSlide]);

  const handleDotClick = useCallback((idx) => {
    clearInterval(autoRef.current);
    clearTimeout(inactivityRef.current);
    goToSlide(idx);
    inactivityRef.current = setTimeout(() => startAuto(slides.length), RESUME_MS);
  }, [goToSlide, startAuto, slides.length]);

  useEffect(() => {
    startAuto(slides.length);
    return () => {
      clearInterval(autoRef.current);
      clearTimeout(inactivityRef.current);
    };
  }, [startAuto, slides.length]);

  const safeActive = active % slides.length;
  const { badge, renderHeadline, description, Visual } = slides[safeActive];

  return (
    <section className="relative min-h-screen bg-[#f3f8ff] flex items-center overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[120px]"/>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[120px]"/>
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-20 pb-10 lg:pt-24 lg:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left column */}
          <div className="max-w-xl">
            {/* Animated: badge + headline + description */}
            <div className={`transition-all duration-300 ${fading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              <span className="inline-block text-xs font-bold font-heading tracking-widest uppercase text-[#fe6a34] bg-orange-500/10 px-3 py-1.5 rounded-full mb-5">
                {badge}
              </span>
              <h1 className="font-heading text-3xl sm:text-5xl lg:text-[3.6rem] font-extrabold leading-[1.08] tracking-tight mb-6">
                {renderHeadline()}
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-lg">
                {description}
              </p>
            </div>

            {/* Static: CTA buttons */}
            {user ? (
              <div className="flex flex-wrap gap-3">
                <Link to={dashboardTo}
                  className="bg-[#fe6a34] hover:bg-orange-500 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-lg shadow-orange-500/20">
                  <LayoutDashboard className="w-4 h-4" /> Open Dashboard
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                <Link to="/register?role=shipper"
                  className="bg-[#fe6a34] hover:bg-orange-500 text-white font-bold px-7 py-3.5 rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20">
                  Book Transport
                </Link>
                <Link to="/register?role=owner"
                  className="bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-800 font-semibold px-7 py-3.5 rounded-xl text-sm transition-all">
                  List Your Fleet
                </Link>
                <Link to="/book-demo"
                  className="bg-gray-100 border border-gray-200 hover:bg-gray-200 text-gray-800 font-semibold px-7 py-3.5 rounded-xl text-sm transition-all">
                  Request Demo
                </Link>
              </div>
            )}

            {/* Static: stats row */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10 pt-8 border-t border-gray-200">
                {stats.map(({ icon: Icon, val, label }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-gray-500" />
                    </div>
                    <div>
                      <div className="text-lg font-bold leading-none text-gray-900">{val}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column — visual + dots (desktop only) */}
          <div className="hidden lg:flex flex-col items-center gap-5">
            <div className={`w-full transition-all duration-300 ${fading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              <div className="flex justify-end mb-2">
                <span className="text-[9px] font-heading font-bold uppercase tracking-wider text-[#fe6a34] border border-[#fe6a34]/40 bg-[#fe6a34]/8 px-2.5 py-1 rounded-full">
                  Product Preview
                </span>
              </div>
              <Visual payments={countryPayments} currency={countryCurrency} />
            </div>

            {/* Dot navigation */}
            <div className="flex items-center gap-2.5">
              {slides.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleDotClick(i)}
                  aria-label={s.badge}
                  className={`transition-all duration-300 rounded-full focus:outline-none
                    ${i === safeActive
                      ? "w-6 h-2.5 bg-[#fe6a34]"
                      : "w-2.5 h-2.5 bg-gray-300 hover:bg-gray-400"
                    }`}
                />
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
