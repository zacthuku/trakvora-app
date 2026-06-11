import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TrendingUp, Wallet, Lock, BarChart3, Check, X,
  FileText, ShieldCheck, AlertCircle, ExternalLink,
  ChevronLeft, ChevronRight, Plus, Pencil, Users, DollarSign, Download,
  Receipt, ShieldOff, Clock, Zap,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency } from "@/utils/currency";
import { useCountryConfig } from "@/hooks/useCountryConfig";
import { RevenueTrendChart, TypeBreakdownBars, StatusDoughnut } from "@/features/payments/components/FinanceCharts";
import apiClient from "@/services/apiClient";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n, currency = "KES") {
  if (!n) return `${currency} 0`;
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return formatCurrency(n, currency);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

function todayMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Kenya 2025 PAYE/SHIF/NSSF preview (mirrors backend payroll_service.py)
function previewDeductions(grossMonthly) {
  const g = parseFloat(grossMonthly) || 0;
  if (g <= 0) return { paye: 0, shif: 0, nssf: 0, net: 0 };
  let tax;
  if (g <= 24_000)       tax = g * 0.10;
  else if (g <= 32_333)  tax = 24_000 * 0.10 + (g - 24_000) * 0.25;
  else if (g <= 500_000) tax = 24_000 * 0.10 + 8_333 * 0.25 + (g - 32_333) * 0.30;
  else if (g <= 800_000) tax = 24_000 * 0.10 + 8_333 * 0.25 + 467_667 * 0.30 + (g - 500_000) * 0.325;
  else                   tax = 24_000 * 0.10 + 8_333 * 0.25 + 467_667 * 0.30 + 300_000 * 0.325 + (g - 800_000) * 0.35;
  const paye = Math.max(0, Math.round((tax - 2_400) * 100) / 100);
  const shif = Math.round(g * 0.0275 * 100) / 100;
  const nssf = Math.round(Math.min(g * 0.06, 1_080) * 100) / 100;
  const net  = Math.max(0, Math.round((g - paye - shif - nssf) * 100) / 100);
  return { paye, shif, nssf, net };
}

async function downloadItaxCsv(month) {
  const resp = await apiClient.get("/admin/payroll/itax-csv", { params: { month }, responseType: "blob" });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trakvora_payroll_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, icon: Icon }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-slate-400" />
      </div>
      <p className={`text-xl font-bold font-heading ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-heading mt-1">{label}</p>
      {sub && <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

const ETIMS_STATUS = {
  pending:   "bg-amber-900/40 text-amber-300 border-amber-700/40",
  submitted: "bg-sky-900/40 text-sky-300 border-sky-700/40",
  accepted:  "bg-green-900/40 text-green-300 border-green-700/40",
  failed:    "bg-red-900/40 text-red-300 border-red-700/40",
};

const TX_TYPE_COLORS = {
  escrow_hold:    "bg-amber-900/40 text-amber-300 border-amber-700/40",
  escrow_release: "bg-green-900/40 text-green-300 border-green-700/40",
  escrow_refund:  "bg-blue-900/40 text-blue-300 border-blue-700/40",
  payout:         "bg-violet-900/40 text-violet-300 border-violet-700/40",
  top_up:         "bg-teal-900/40 text-teal-300 border-teal-700/40",
  withdrawal:     "bg-indigo-900/40 text-indigo-300 border-indigo-700/40",
  platform_fee:   "bg-orange-900/40 text-orange-300 border-orange-700/40",
  dispute_hold:   "bg-red-900/40 text-red-300 border-red-700/40",
};

const TX_STATUS_COLORS = {
  completed: "text-green-400",
  pending:   "text-amber-400",
  failed:    "text-red-400",
  reversed:  "text-slate-500",
};

const PAYROLL_STATUS_STYLE = {
  draft:     "bg-slate-800 text-slate-400 border-slate-700",
  approved:  "bg-amber-900/40 text-amber-300 border-amber-700/40",
  paid:      "bg-green-900/40 text-green-300 border-green-700/40",
  cancelled: "bg-red-900/40 text-red-300 border-red-700/40",
};

const ROLE_LABELS = {
  super_admin:        "Super Admin",
  operations_admin:   "Ops Admin",
  finance_admin:      "Finance Admin",
  field_inspector:    "Field Inspector",
  iot_technician:     "IoT Tech",
  compliance_officer: "Compliance",
  support_agent:      "Support",
};

const COMMISSION_STATUS_STYLE = {
  pending:  "bg-amber-900/40 text-amber-300 border-amber-700/40",
  overdue:  "bg-red-900/40 text-red-300 border-red-700/40",
  paid:     "bg-green-900/40 text-green-300 border-green-700/40",
  waived:   "bg-slate-800 text-slate-400 border-slate-700",
  extended: "bg-sky-900/40 text-sky-300 border-sky-700/40",
};

function timeLeft(dueAt) {
  if (!dueAt) return "—";
  const ms = new Date(dueAt) - Date.now();
  if (ms <= 0) return "Overdue";
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `${Math.ceil(ms / 60_000)}m`;
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const TX_TYPES    = ["", "escrow_hold", "escrow_release", "escrow_refund", "payout", "top_up", "withdrawal", "platform_fee", "dispute_hold"];
const TX_STATUSES = ["", "completed", "pending", "failed", "reversed"];

const EMPTY_FORM = {
  admin_user_id: "",
  base_salary_kes: "",
  housing_allowance_kes: "",
  transport_allowance_kes: "",
  bonus_kes: "",
  bonus_reason: "",
  employee_pin: "",
  notes: "",
};

// ── Payroll Modal ─────────────────────────────────────────────────────────────

function PayrollModal({ open, onClose, record, payrollMonth, admins, onSave }) {
  const { revenueAuthority } = useCountryConfig();
  const [form, setForm] = useState(() =>
    record
      ? {
          admin_user_id: record.admin_user_id,
          base_salary_kes: String(record.base_salary_kes),
          housing_allowance_kes: String(record.housing_allowance_kes),
          transport_allowance_kes: String(record.transport_allowance_kes),
          bonus_kes: String(record.bonus_kes),
          bonus_reason: record.bonus_reason || "",
          employee_pin: record.employee_pin || "",
          notes: record.notes || "",
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (!open) return null;

  const gross =
    (parseFloat(form.base_salary_kes) || 0) +
    (parseFloat(form.housing_allowance_kes) || 0) +
    (parseFloat(form.transport_allowance_kes) || 0) +
    (parseFloat(form.bonus_kes) || 0);

  const { paye, shif, nssf, net } = previewDeductions(gross);

  async function handleSave() {
    if (!form.admin_user_id) { setErr("Select an employee."); return; }
    if (gross <= 0) { setErr("Enter at least one salary component."); return; }
    setSaving(true); setErr("");
    try {
      await onSave({
        admin_user_id: form.admin_user_id,
        payment_month: payrollMonth,
        base_salary_kes: parseFloat(form.base_salary_kes) || 0,
        housing_allowance_kes: parseFloat(form.housing_allowance_kes) || 0,
        transport_allowance_kes: parseFloat(form.transport_allowance_kes) || 0,
        bonus_kes: parseFloat(form.bonus_kes) || 0,
        bonus_reason: form.bonus_reason || null,
        employee_pin: form.employee_pin || null,
        notes: form.notes || null,
      });
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const numField = (key, label) => (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading block mb-1">{label}</label>
      <input type="number" min="0" step="0.01" value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900">
          <h3 className="text-sm font-bold text-white font-heading">
            {record ? "Edit Salary Record" : "Add Employee Payroll"} — {payrollMonth}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          {err && <div className="text-xs text-red-300 bg-red-900/30 border border-red-700/40 rounded-lg px-3 py-2">{err}</div>}

          {/* Employee select */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading block mb-1">Employee</label>
            <select value={form.admin_user_id} onChange={e => setForm(f => ({ ...f, admin_user_id: e.target.value }))}
              disabled={!!record}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50">
              <option value="">Select employee…</option>
              {admins.map(a => (
                <option key={a.id} value={a.id}>
                  {a.full_name} — {ROLE_LABELS[a.admin_role] ?? a.admin_role ?? "Admin"}
                </option>
              ))}
            </select>
          </div>

          {/* Salary components */}
          <div className="grid grid-cols-2 gap-3">
            {numField("base_salary_kes",         "Base Salary (KES)")}
            {numField("housing_allowance_kes",    "Housing Allowance")}
            {numField("transport_allowance_kes",  "Transport Allowance")}
            {numField("bonus_kes",                "Bonus (KES)")}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading block mb-1">Bonus Reason</label>
            <input type="text" value={form.bonus_reason} onChange={e => setForm(f => ({ ...f, bonus_reason: e.target.value }))}
              placeholder="e.g. Q1 performance"
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading block mb-1">{`Employee ${revenueAuthority} PIN`}</label>
            <input type="text" value={form.employee_pin} onChange={e => setForm(f => ({ ...f, employee_pin: e.target.value }))}
              placeholder="e.g. A012345678Z"
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 uppercase" />
          </div>

          {/* Live deductions preview */}
          {gross > 0 && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-heading">Tax Deductions Preview</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <span className="text-slate-400">Gross Pay</span>     <span className="text-right text-white font-mono font-semibold">{fmtMoney(gross)}</span>
                <span className="text-slate-400">PAYE</span>          <span className="text-right text-red-400 font-mono">− {fmtMoney(paye)}</span>
                <span className="text-slate-400">SHIF (2.75%)</span>  <span className="text-right text-red-400 font-mono">− {fmtMoney(shif)}</span>
                <span className="text-slate-400">NSSF (6%, max 1,080)</span> <span className="text-right text-red-400 font-mono">− {fmtMoney(nssf)}</span>
                <span className="text-slate-500 border-t border-slate-700 pt-1">Net Pay</span>
                <span className="text-right text-green-400 font-mono font-bold border-t border-slate-700 pt-1">{fmtMoney(net)}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-heading block mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold font-heading">Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-xs rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold font-heading disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── P9 Annual Tax Certificate Modal ───────────────────────────────────────────

function P9Modal({ open, onClose, userId, year }) {
  const { revenueAuthority } = useCountryConfig();
  const { data, isLoading } = useQuery({
    queryKey: ["p9", userId, year],
    queryFn: () => adminApi.getP9(userId, year),
    enabled: open && !!userId,
    staleTime: 60_000,
  });

  if (!open) return null;

  const months = [
    "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-900">
          <div>
            <h3 className="text-sm font-bold text-white font-heading">P9 Tax Certificate — {year}</h3>
            {data && <p className="text-xs text-slate-400 mt-0.5">{data.employee_name} {data.employee_pin ? `· ${revenueAuthority} PIN: ${data.employee_pin}` : ""}</p>}
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="py-10 text-center text-slate-500 text-sm">Loading…</div>
          ) : !data || data.months.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">No payroll records for {year}.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-800/30 text-[10px] text-slate-500 font-bold uppercase tracking-widest font-heading">
                      <th className="text-left px-3 py-2">Month</th>
                      <th className="text-right px-3 py-2">Gross</th>
                      <th className="text-right px-3 py-2">PAYE</th>
                      <th className="text-right px-3 py-2">SHIF</th>
                      <th className="text-right px-3 py-2">NSSF</th>
                      <th className="text-right px-3 py-2">Net Pay</th>
                      <th className="text-center px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.months.map((m) => {
                      const idx = parseInt(m.month.split("-")[1], 10) - 1;
                      return (
                        <tr key={m.month} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                          <td className="px-3 py-2 text-slate-300">{months[idx]} {year}</td>
                          <td className="px-3 py-2 text-right font-mono text-white">{fmtMoney(m.gross_kes)}</td>
                          <td className="px-3 py-2 text-right font-mono text-red-400">{fmtMoney(m.paye_kes)}</td>
                          <td className="px-3 py-2 text-right font-mono text-red-400">{fmtMoney(m.shif_kes)}</td>
                          <td className="px-3 py-2 text-right font-mono text-red-400">{fmtMoney(m.nssf_kes)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-green-400">{fmtMoney(m.net_pay_kes)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${PAYROLL_STATUS_STYLE[m.status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>{m.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-700 bg-slate-800/50 font-bold">
                      <td className="px-3 py-2.5 text-slate-300 text-[10px] uppercase tracking-widest font-heading">Annual Total</td>
                      <td className="px-3 py-2.5 text-right font-mono text-white">{fmtMoney(data.annual.gross_kes)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-400">{fmtMoney(data.annual.paye_kes)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-400">{fmtMoney(data.annual.shif_kes)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-red-400">{fmtMoney(data.annual.nssf_kes)}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-green-400">{fmtMoney(data.annual.net_pay_kes)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="bg-slate-800/60 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Total PAYE Deducted</p>
                  <p className="text-lg font-bold text-red-400 font-heading">{fmtMoney(data.annual.paye_kes)}</p>
                </div>
                <div className="bg-slate-800/60 rounded-xl p-3">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest">Total Net Paid</p>
                  <p className="text-lg font-bold text-green-400 font-heading">{fmtMoney(data.annual.net_pay_kes)}</p>
                </div>
              </div>

              <p className="mt-4 text-[10px] text-slate-600 text-center">
                {`This P9 summary is for ${revenueAuthority} annual filing. Employer PIN: `}{data.months[0] ? `see company ${revenueAuthority} PIN above` : "—"}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FinanceAdminDashboard() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { revenueAuthority } = useCountryConfig();
  const isSuperAdmin = user?.admin_role === "super_admin";

  const [txPage, setTxPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actionError, setActionError] = useState("");
  const TX_LIMIT = 20;

  const [payrollMonth, setPayrollMonth] = useState(todayMonth);
  const [payrollModal, setPayrollModal] = useState({ open: false, record: null });
  const [p9Modal, setP9Modal] = useState({ open: false, userId: null });
  const [csvDownloading, setCsvDownloading] = useState(false);

  // ── Data fetches ────────────────────────────────────────────────────────────
  const { data: dash } = useQuery({ queryKey: ["admin-dashboard"], queryFn: adminApi.getDashboard, staleTime: 30_000 });
  const { data: revenueTxData } = useQuery({ queryKey: ["admin-revenue-chart"], queryFn: () => adminApi.getTransactions({ limit: 100, type: "platform_fee" }), staleTime: 60_000 });
  const { data: payoutTxData }  = useQuery({ queryKey: ["admin-payout-chart"],  queryFn: () => adminApi.getTransactions({ limit: 100, type: "payout" }),       staleTime: 60_000 });
  const { data: pendingWithdrawals } = useQuery({ queryKey: ["admin-pending-withdrawals"], queryFn: () => adminApi.getTransactions({ type: "withdrawal", status: "pending", limit: 10 }), staleTime: 15_000 });
  const { data: etimsData }          = useQuery({ queryKey: ["admin-etims"],               queryFn: () => adminApi.getEtimsInvoices({ limit: 10 }),                                       staleTime: 60_000 });

  const txParams = { page: txPage, limit: TX_LIMIT, ...(typeFilter && { type: typeFilter }), ...(statusFilter && { status: statusFilter }) };
  const { data: txData, isLoading: txLoading } = useQuery({ queryKey: ["admin-transactions", txParams], queryFn: () => adminApi.getTransactions(txParams), staleTime: 15_000, keepPreviousData: true });

  const { data: payrollData }         = useQuery({ queryKey: ["admin-payroll", payrollMonth], queryFn: () => adminApi.getPayroll({ month: payrollMonth }), staleTime: 20_000 });
  const { data: payrollAdmins = [] }  = useQuery({ queryKey: ["admin-payroll-admins"],         queryFn: adminApi.getPayrollAdmins,                          staleTime: 120_000 });

  const [commissionStatusFilter, setCommissionStatusFilter] = useState("pending");
  const todayPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [reconcilePeriod, setReconcilePeriod] = useState(todayPeriod);
  const [reconcileDownloading, setReconcileDownloading] = useState(false);
  const { data: reconcileData, isLoading: reconcileLoading } = useQuery({
    queryKey: ["commission-reconcile", reconcilePeriod],
    queryFn: () => apiClient.get(`/reports/commissions?period=${reconcilePeriod}`).then((r) => r.data),
    staleTime: 30_000,
  });
  async function downloadReconcileXlsx() {
    setReconcileDownloading(true);
    try {
      const resp = await apiClient.get(`/reports/commissions.xlsx?period=${reconcilePeriod}`, { responseType: "blob" });
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commissions-${reconcilePeriod}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setReconcileDownloading(false);
    }
  }
  const { data: commissionSummary } = useQuery({ queryKey: ["admin-commission-summary"], queryFn: adminApi.getCommissionSummary, staleTime: 20_000 });
  const { data: commissionData, isLoading: commissionLoading } = useQuery({
    queryKey: ["admin-commissions", commissionStatusFilter],
    queryFn: () => adminApi.getAdminCommissions({ status: commissionStatusFilter || undefined, page: 1, page_size: 20 }),
    staleTime: 15_000,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────
  const approveMut = useMutation({
    mutationFn: (id) => adminApi.approveWithdrawal(id, { provider: "manual" }),
    onSuccess: () => { setActionError(""); qc.invalidateQueries({ queryKey: ["admin-pending-withdrawals"] }); qc.invalidateQueries({ queryKey: ["admin-transactions"] }); qc.invalidateQueries({ queryKey: ["admin-dashboard"] }); },
    onError: (err) => setActionError(err?.response?.data?.detail || "Approval failed."),
  });
  const rejectMut = useMutation({
    mutationFn: (id) => adminApi.rejectWithdrawal(id, "Rejected by finance admin"),
    onSuccess: () => { setActionError(""); qc.invalidateQueries({ queryKey: ["admin-pending-withdrawals"] }); qc.invalidateQueries({ queryKey: ["admin-transactions"] }); },
    onError: (err) => setActionError(err?.response?.data?.detail || "Rejection failed."),
  });
  const waiveMut   = useMutation({ mutationFn: ({ id }) => adminApi.waiveCommission(id, "Waived by admin"), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-commissions"] }); qc.invalidateQueries({ queryKey: ["admin-commission-summary"] }); } });
  const extendMut  = useMutation({ mutationFn: ({ id }) => adminApi.extendCommission(id, 48), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-commissions"] }); qc.invalidateQueries({ queryKey: ["admin-commission-summary"] }); } });
  const collectMut = useMutation({ mutationFn: ({ id }) => adminApi.forceCollectCommission(id), onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-commissions"] }); qc.invalidateQueries({ queryKey: ["admin-commission-summary"] }); } });

  const upsertMut  = useMutation({ mutationFn: adminApi.upsertPayroll, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payroll", payrollMonth] }) });
  const approvePay = useMutation({ mutationFn: adminApi.approvePayroll, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payroll", payrollMonth] }) });
  const markPaid   = useMutation({ mutationFn: adminApi.markPayrollPaid, onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-payroll", payrollMonth] }) });

  // ── Derived data ────────────────────────────────────────────────────────────
  const f = dash?.finance ?? {};
  const currency = f.currency_totals?.[0]?.currency || "KES";
  const revenueTxs  = revenueTxData?.items ?? [];
  const payoutTxs   = payoutTxData?.items ?? [];
  const withdrawals = pendingWithdrawals?.items ?? [];
  const etimsInvoices = etimsData?.items ?? [];
  const etimsTotal    = etimsData?.total ?? 0;
  const txs     = txData?.items ?? [];
  const txTotal = txData?.total ?? 0;
  const txPages = Math.max(1, Math.ceil(txTotal / TX_LIMIT));
  const payroll = payrollData ?? [];

  const commissionInvoices = commissionData?.items ?? [];
  const cs = commissionSummary ?? {};

  const totalVatBilled = etimsInvoices.reduce((s, inv) => s + (inv.vat_amount_kes || 0), 0);
  const totalInvoiced  = etimsInvoices.reduce((s, inv) => s + (inv.total_amount_kes || 0), 0);
  const kratPin        = etimsInvoices[0]?.seller_pin;

  const payrollGross   = payroll.reduce((s, r) => s + (r.total_kes || 0), 0);
  const payrollPaye    = payroll.reduce((s, r) => s + (r.paye_kes   || 0), 0);
  const payrollNet     = payroll.reduce((s, r) => s + (r.net_pay_kes || 0), 0);
  const payrollBonuses = payroll.reduce((s, r) => s + (r.bonus_kes  || 0), 0);

  const currentYear = new Date().getFullYear();

  async function handleCsvDownload() {
    setCsvDownloading(true);
    try { await downloadItaxCsv(payrollMonth); } finally { setCsvDownloading(false); }
  }

  return (
    <div className="py-8 space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white font-heading">Finance Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">{`Revenue, payouts, transactions, ${revenueAuthority} compliance, and employee payroll`}</p>
        </div>
        {kratPin && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />
            <div className="text-right">
              <p className="text-[9px] text-slate-500 uppercase tracking-widest">{`Company ${revenueAuthority} PIN`}</p>
              <p className="text-xs font-bold text-white font-mono">{kratPin}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Platform Revenue"   value={fmtMoney(f.platform_revenue_kes, currency)}    color="text-green-400"  sub="All-time fee income"    icon={TrendingUp} />
        <KpiCard label="Total Wallet Float" value={fmtMoney(f.total_wallet_balance_kes, currency)} color="text-white"      sub="Combined user balances" icon={Wallet} />
        <KpiCard label="Escrowed"           value={fmtMoney(f.total_escrow_kes, currency)}         color="text-amber-400"  sub="Pending release"        icon={Lock} />
        <KpiCard label="Transactions"       value={(f.total_transactions ?? 0).toLocaleString()}   color="text-violet-400" sub="Total records"          icon={BarChart3} />
      </div>

      {/* ── Commission Summary Strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Overdue KES",    value: fmtMoney(cs.total_overdue_kes, currency),  color: "text-red-400",    icon: AlertCircle },
          { label: "Pending KES",    value: fmtMoney(cs.total_pending_kes, currency),  color: "text-amber-300",  icon: Clock },
          { label: "Blocked Users",  value: (cs.blocked_by_commission_count ?? 0).toString(), color: "text-red-500", icon: ShieldOff },
          { label: "Total Collected", value: fmtMoney(cs.total_paid_kes, currency),   color: "text-green-400",  icon: Receipt },
        ].map((c) => (
          <div key={c.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
            <c.icon className={`w-5 h-5 shrink-0 ${c.color}`} />
            <div>
              <p className={`text-lg font-bold font-heading ${c.color}`}>{c.value}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-heading">{c.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Commission Invoices ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-400" /> Commission Invoices
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Platform fees owed by carriers per completed shipment</p>
          </div>
          <div className="flex gap-2">
            {["pending","overdue","paid","waived","extended",""].map((s) => (
              <button key={s} onClick={() => setCommissionStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest font-heading transition-colors ${commissionStatusFilter === s ? "bg-violet-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                {s || "All"}
              </button>
            ))}
          </div>
        </div>
        {commissionLoading ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">Loading…</div>
        ) : commissionInvoices.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-600 text-sm">No commission invoices{commissionStatusFilter ? ` with status: ${commissionStatusFilter}` : ""}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  {["Owner","Amount","Rate","Status","Due","Actions"].map((h,i) => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading ${i === 5 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissionInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-white">{inv.owner_name || inv.owner_id?.slice(0,8)}</p>
                      {inv.auto_blocked && <span className="text-[9px] text-red-400 font-bold uppercase">Blocked</span>}
                    </td>
                    <td className="px-4 py-3"><span className="text-xs font-bold font-mono text-amber-300">{fmtMoney(inv.amount_kes, currency)}</span></td>
                    <td className="px-4 py-3"><span className="text-[10px] text-slate-400 font-mono">{inv.rate_pct}%</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${COMMISSION_STATUS_STYLE[inv.status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-medium ${inv.status === "overdue" || (inv.due_at && new Date(inv.due_at) < new Date()) ? "text-red-400" : "text-slate-400"}`}>
                        {timeLeft(inv.due_at)} · {inv.due_at ? new Date(inv.due_at).toLocaleDateString("en-KE",{day:"2-digit",month:"short"}) : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {["pending","overdue","extended"].includes(inv.status) && (
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => collectMut.mutate({ id: inv.id })} disabled={collectMut.isPending}
                            title="Force collect from wallet"
                            className="flex items-center gap-1 px-2 py-1 bg-green-900/50 hover:bg-green-800/70 text-green-300 text-[9px] font-bold rounded-lg disabled:opacity-40">
                            <Zap className="w-3 h-3" /> Collect
                          </button>
                          <button onClick={() => extendMut.mutate({ id: inv.id })} disabled={extendMut.isPending}
                            title="Extend due date by 48h"
                            className="flex items-center gap-1 px-2 py-1 bg-sky-900/50 hover:bg-sky-800/70 text-sky-300 text-[9px] font-bold rounded-lg disabled:opacity-40">
                            <Clock className="w-3 h-3" /> +48h
                          </button>
                          <button onClick={() => waiveMut.mutate({ id: inv.id })} disabled={waiveMut.isPending}
                            title="Waive this invoice"
                            className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[9px] font-bold rounded-lg disabled:opacity-40">
                            <X className="w-3 h-3" /> Waive
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-0.5">Revenue Trend</h3>
          <p className="text-xs text-slate-500 mb-4">Platform fee income by week</p>
          <RevenueTrendChart transactions={revenueTxs} currency={currency} />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-0.5">Status Split</h3>
          <p className="text-xs text-slate-500 mb-4">Transaction outcomes</p>
          <StatusDoughnut transactions={txs} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-0.5">Payout Volume</h3>
          <p className="text-xs text-slate-500 mb-4">Carrier & driver payments by week</p>
          <RevenueTrendChart transactions={payoutTxs} currency={currency} />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-slate-300 mb-0.5">Volume by Transaction Type</h3>
          <p className="text-xs text-slate-500 mb-5">Proportion of total {currency} volume</p>
          <TypeBreakdownBars transactions={payoutTxs} dark />
        </div>
      </div>

      {/* ── Pending Withdrawals ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Pending Withdrawals</h3>
            <p className="text-xs text-slate-500 mt-0.5">Cashout requests awaiting approval</p>
          </div>
          <span className="text-[11px] text-slate-500">{withdrawals.length} pending</span>
        </div>
        {actionError && (
          <div className="mx-5 mt-4 flex items-center gap-2 rounded-xl border border-red-700/40 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
            <button onClick={() => setActionError("")} className="ml-auto text-red-400">✕</button>
          </div>
        )}
        {withdrawals.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-600 text-sm">No pending withdrawals</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  {["User","Amount","Provider","Date",""].map(h => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3"><p className="text-xs font-semibold text-white">{tx.user_name || "—"}</p><p className="text-[10px] text-slate-500">{tx.user_email || tx.user_role || ""}</p></td>
                    <td className="px-4 py-3"><p className="text-xs font-bold text-amber-300 font-mono">{fmtMoney(tx.amount_kes, currency)}</p></td>
                    <td className="px-4 py-3"><p className="text-[10px] text-slate-400 capitalize">{tx.provider || "—"}</p></td>
                    <td className="px-4 py-3"><p className="text-[10px] text-slate-500">{fmtDate(tx.created_at)}</p></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => approveMut.mutate(tx.id)} disabled={approveMut.isPending || rejectMut.isPending}
                          className="flex items-center gap-1 px-2.5 py-1 bg-green-800/60 hover:bg-green-700/80 text-green-300 text-[10px] font-bold rounded-lg disabled:opacity-40">
                          <Check className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => rejectMut.mutate(tx.id)} disabled={approveMut.isPending || rejectMut.isPending}
                          className="flex items-center gap-1 px-2.5 py-1 bg-red-900/60 hover:bg-red-800/80 text-red-300 text-[10px] font-bold rounded-lg disabled:opacity-40">
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── All Transactions ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">All Transactions</h3>
          <div className="flex gap-2">
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setTxPage(1); }}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:border-violet-500 outline-none">
              {TX_TYPES.map(t => <option key={t} value={t}>{t ? t.replace(/_/g, " ") : "All Types"}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setTxPage(1); }}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-3 py-2 focus:border-violet-500 outline-none">
              {TX_STATUSES.map(s => <option key={s} value={s}>{s || "All Statuses"}</option>)}
            </select>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  {["User","Type","Amount","Status","Reference","Description","Date",""].map(h => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading ${h === "" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-800"><td colSpan={8} className="px-4 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td></tr>
                  ))
                ) : txs.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-slate-600">No transactions found</td></tr>
                ) : (
                  txs.map((tx) => (
                    <tr key={tx.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3"><p className="text-xs font-semibold text-white">{tx.user_name}</p><p className="text-[10px] text-slate-500 capitalize">{tx.user_role}</p></td>
                      <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest font-heading ${TX_TYPE_COLORS[tx.transaction_type] ?? "bg-slate-800 text-slate-500 border-slate-700"}`}>{tx.transaction_type?.replace(/_/g, " ")}</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-bold text-white font-heading">{formatCurrency(tx.amount ?? tx.amount_kes ?? 0, tx.currency || currency)}</span></td>
                      <td className="px-4 py-3"><span className={`text-xs font-semibold capitalize font-heading ${TX_STATUS_COLORS[tx.status] ?? "text-slate-400"}`}>{tx.status}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] text-slate-500 font-mono">{tx.reference || "–"}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] text-slate-500 line-clamp-2 max-w-[180px]">{tx.description || "–"}</span></td>
                      <td className="px-4 py-3"><span className="text-[10px] text-slate-500">{tx.created_at ? new Date(tx.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "2-digit" }) : "–"}</span></td>
                      <td className="px-4 py-3">
                        {tx.transaction_type === "withdrawal" && tx.status === "pending" ? (
                          <div className="flex justify-end gap-1">
                            <button type="button" onClick={() => approveMut.mutate(tx.id)} disabled={approveMut.isPending || rejectMut.isPending}
                              className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/70 disabled:opacity-40">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => rejectMut.mutate(tx.id)} disabled={approveMut.isPending || rejectMut.isPending}
                              className="h-7 w-7 flex items-center justify-center rounded-lg bg-red-900/50 text-red-300 hover:bg-red-800/70 disabled:opacity-40">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : <span className="block text-right text-[10px] text-slate-600">–</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-[11px] text-slate-500">Showing {txs.length ? (txPage-1)*TX_LIMIT+1 : 0}–{Math.min(txPage*TX_LIMIT, txTotal)} of {txTotal}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setTxPage(p => Math.max(1, p-1))} disabled={txPage <= 1} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-xs text-slate-400 min-w-[60px] text-center">{txPage} / {txPages}</span>
              <button onClick={() => setTxPage(p => Math.min(txPages, p+1))} disabled={txPage >= txPages} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tax Invoices ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">{`${revenueAuthority} Tax Invoices`}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{`Electronic tax invoice records submitted to ${revenueAuthority}`}</p>
          </div>
          {etimsTotal > 0 && (
            <div className="flex items-center gap-4 text-right">
              <div><p className="text-[9px] text-slate-500 uppercase tracking-wider">VAT Billed</p><p className="text-xs font-bold text-amber-300 font-mono">{fmtMoney(totalVatBilled, currency)}</p></div>
              <div><p className="text-[9px] text-slate-500 uppercase tracking-wider">Total Invoiced</p><p className="text-xs font-bold text-green-300 font-mono">{fmtMoney(totalInvoiced, currency)}</p></div>
            </div>
          )}
        </div>
        {etimsInvoices.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <FileText className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-600">{`No ${revenueAuthority} invoices generated yet`}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  {["Invoice #","Buyer","Type","Taxable","VAT","Total","Status","Submitted"].map((h,i) => (
                    <th key={h} className={`px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest ${i>=3&&i<=5?"text-right":"text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {etimsInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3"><p className="text-[10px] font-mono text-slate-300">{inv.internal_invoice_no}</p>{inv.cu_invoice_no && <p className="text-[9px] text-slate-500 mt-0.5">CUIN: {inv.cu_invoice_no}</p>}</td>
                    <td className="px-4 py-3"><p className="text-xs text-white">{inv.buyer_name}</p>{inv.buyer_pin && <p className="text-[9px] text-slate-500 font-mono">{`${revenueAuthority}: ${inv.buyer_pin}`}</p>}</td>
                    <td className="px-4 py-3"><span className="text-[10px] text-slate-400 capitalize">{inv.invoice_type?.replace("_"," ")}</span></td>
                    <td className="px-4 py-3 text-right"><p className="text-xs font-mono text-slate-300">{fmtMoney(inv.taxable_amount_kes, currency)}</p></td>
                    <td className="px-4 py-3 text-right"><p className="text-xs font-mono text-amber-400">{fmtMoney(inv.vat_amount_kes, currency)}</p></td>
                    <td className="px-4 py-3 text-right"><p className="text-xs font-bold font-mono text-white">{fmtMoney(inv.total_amount_kes, currency)}</p></td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${ETIMS_STATUS[inv.status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>{inv.status}</span></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-1.5"><p className="text-[10px] text-slate-500">{fmtDate(inv.kra_submission_date || inv.created_at)}</p>{inv.qr_code_url && <a href={inv.qr_code_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3 h-3 text-sky-500 hover:text-sky-300" /></a>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Employee Payroll ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Employee Payroll</h3>
            <p className="text-xs text-slate-500 mt-0.5">Salary, allowances, Kenya tax deductions (PAYE · SHIF · NSSF), and net pay</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="month" value={payrollMonth} onChange={e => setPayrollMonth(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500" />
            <button onClick={handleCsvDownload} disabled={csvDownloading || payroll.length === 0}
              title="Export iTax P10 CSV"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg disabled:opacity-40">
              <Download className="w-3.5 h-3.5" /> {csvDownloading ? "…" : "iTax CSV"}
            </button>
            <button onClick={() => setPayrollModal({ open: true, record: null })}
              className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg font-heading">
              <Plus className="w-3.5 h-3.5" /> Add Employee
            </button>
          </div>
        </div>

        {/* Payroll summary chips */}
        {payroll.length > 0 && (
          <div className="flex flex-wrap gap-5 px-5 py-3 border-b border-slate-800 bg-slate-800/20">
            <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-500" /><span className="text-xs text-slate-400"><span className="font-bold text-white">{payroll.length}</span> employees</span></div>
            <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-slate-500" /><span className="text-xs text-slate-400">Gross: <span className="font-bold text-white">{fmtMoney(payrollGross)}</span></span></div>
            <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-red-500" /><span className="text-xs text-slate-400">PAYE: <span className="font-bold text-red-400">{fmtMoney(payrollPaye)}</span></span></div>
            <div className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5 text-green-500" /><span className="text-xs text-slate-400">Net Pay: <span className="font-bold text-green-400">{fmtMoney(payrollNet)}</span></span></div>
            {payrollBonuses > 0 && <div className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-amber-500" /><span className="text-xs text-slate-400">Bonuses: <span className="font-bold text-amber-400">{fmtMoney(payrollBonuses)}</span></span></div>}
          </div>
        )}

        {payroll.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <DollarSign className="w-8 h-8 text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-600">No payroll records for {payrollMonth}</p>
            <p className="text-xs text-slate-700 mt-1">Click Add Employee to create salary entries for this month.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Employee</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gross</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-bold text-red-700 uppercase tracking-widest">PAYE</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-bold text-red-700 uppercase tracking-widest">SHIF</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-bold text-red-700 uppercase tracking-widest">NSSF</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-bold text-green-700 uppercase tracking-widest">Net Pay</th>
                  <th className="text-left px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payroll.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3"><p className="text-xs font-semibold text-white">{r.employee_name}</p><p className="text-[10px] text-slate-500">{r.employee_pin ? <span className="font-mono">{r.employee_pin}</span> : r.employee_email}</p></td>
                    <td className="px-4 py-3"><span className="text-[10px] text-slate-400">{ROLE_LABELS[r.admin_role] ?? r.admin_role ?? "—"}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-xs font-mono text-slate-300">{fmtMoney(r.total_kes)}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-xs font-mono text-red-400">{fmtMoney(r.paye_kes)}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-xs font-mono text-red-400">{fmtMoney(r.shif_kes)}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-xs font-mono text-red-400">{fmtMoney(r.nssf_kes)}</span></td>
                    <td className="px-4 py-3 text-right"><span className="text-xs font-bold font-mono text-green-400">{fmtMoney(r.net_pay_kes)}</span></td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${PAYROLL_STATUS_STYLE[r.status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setP9Modal({ open: true, userId: r.admin_user_id })} title="View P9"
                          className="h-7 px-2 flex items-center gap-1 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white text-[10px] font-bold">
                          P9
                        </button>
                        <button onClick={() => setPayrollModal({ open: true, record: r })} title="Edit"
                          className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {r.status === "draft" && isSuperAdmin && (
                          <button onClick={() => approvePay.mutate(r.id)} disabled={approvePay.isPending}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-900/50 hover:bg-amber-800/70 text-amber-300 text-[10px] font-bold rounded-lg disabled:opacity-40">
                            Approve
                          </button>
                        )}
                        {r.status === "approved" && (
                          <button onClick={() => markPaid.mutate(r.id)} disabled={markPaid.isPending}
                            className="flex items-center gap-1 px-2 py-1 bg-green-900/50 hover:bg-green-800/70 text-green-300 text-[10px] font-bold rounded-lg disabled:opacity-40">
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Commission Reconciliation ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-violet-400" /> Commission Reconciliation
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Invoiced vs. collected vs. outstanding by partner</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={reconcilePeriod}
              onChange={(e) => setReconcilePeriod(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-violet-500"
            />
            <button
              onClick={downloadReconcileXlsx}
              disabled={reconcileDownloading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {reconcileDownloading ? "Exporting…" : "Export Excel"}
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        {reconcileData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-b border-slate-800">
            {[
              { label: "Total Invoiced",   value: fmtMoney(reconcileData.total_invoiced_kes, currency),   color: "text-white" },
              { label: "Collected",        value: fmtMoney(reconcileData.total_collected_kes, currency),  color: "text-green-400" },
              { label: "Outstanding",      value: fmtMoney(reconcileData.total_outstanding_kes, currency), color: "text-amber-400" },
              { label: "Overdue",          value: fmtMoney(reconcileData.total_overdue_kes, currency),    color: "text-red-400" },
            ].map((k) => (
              <div key={k.label} className="px-5 py-4 border-r border-slate-800 last:border-r-0">
                <p className={`text-lg font-bold font-heading ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Per-partner table */}
        <div className="overflow-x-auto">
          {reconcileLoading ? (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">Loading…</div>
          ) : reconcileData?.by_partner?.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-slate-500 text-sm">No commission data for {reconcilePeriod}.</div>
          ) : (
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Partner", "Invoices", "Invoiced (KES)", "Paid (KES)", "Outstanding (KES)", "Overdue (KES)", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(reconcileData?.by_partner ?? []).map((row) => {
                  const statusStyles = {
                    clear:   "bg-green-900/30 text-green-400 border-green-800",
                    partial: "bg-amber-900/30 text-amber-400 border-amber-800",
                    overdue: "bg-red-900/30 text-red-400 border-red-800",
                    blocked: "bg-red-900/50 text-red-300 border-red-700",
                  };
                  return (
                    <tr key={row.owner_id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 text-white text-sm font-medium">{row.owner_name}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs text-center">{row.invoice_count}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-300">{fmtMoney(row.invoiced_kes, currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-green-400">{fmtMoney(row.paid_kes, currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-amber-400">{fmtMoney(row.outstanding_kes, currency)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-red-400">{fmtMoney(row.overdue_kes, currency)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${statusStyles[row.status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <PayrollModal
        open={payrollModal.open}
        onClose={() => setPayrollModal({ open: false, record: null })}
        record={payrollModal.record}
        payrollMonth={payrollMonth}
        admins={payrollAdmins}
        onSave={upsertMut.mutateAsync}
      />
      <P9Modal
        open={p9Modal.open}
        onClose={() => setP9Modal({ open: false, userId: null })}
        userId={p9Modal.userId}
        year={currentYear}
      />
    </div>
  );
}
