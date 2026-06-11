import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Clock, RefreshCw, XCircle } from "lucide-react";
import apiClient from "@/services/apiClient";
import { PageSpinner } from "@/components/ui/Spinner";

const STATUS_CONFIG = {
  accepted: { label: "Accepted", color: "bg-teal-100 text-teal-700", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700", icon: <Clock className="w-3.5 h-3.5" /> },
  pending:   { label: "Pending", color: "bg-amber-100 text-amber-700", icon: <Clock className="w-3.5 h-3.5" /> },
  failed:    { label: "Failed", color: "bg-red-100 text-red-700", icon: <XCircle className="w-3.5 h-3.5" /> },
};

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd || "—";
  return `${yyyymmdd.slice(6, 8)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(0, 4)}`;
}

const adminEtimsApi = {
  list: (params) => apiClient.get("/etims/admin/invoices", { params }).then((r) => r.data),
  retry: (id) => apiClient.post(`/etims/admin/invoices/${id}/retry`).then((r) => r.data),
};

export default function AdminEtimsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-etims", page, statusFilter],
    queryFn: () => adminEtimsApi.list({ page, page_size: 50, status: statusFilter || undefined }),
  });

  const retryMutation = useMutation({
    mutationFn: (id) => adminEtimsApi.retry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-etims"] }),
  });

  const invoices = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const failedCount = invoices.filter((i) => i.status === "failed").length;
  const acceptedCount = invoices.filter((i) => i.status === "accepted").length;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900">eTIMS Invoices</h1>
          <p className="text-sm text-slate-500 mt-1">
            KRA eTIMS submission status for all platform fee and subscription invoices.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <div className="card px-4 py-2 text-center">
            <div className="font-semibold text-teal-600">{acceptedCount}</div>
            <div className="text-xs text-slate-400">Accepted (this page)</div>
          </div>
          <div className="card px-4 py-2 text-center">
            <div className="font-semibold text-red-500">{failedCount}</div>
            <div className="text-xs text-slate-400">Failed (this page)</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        {["", "accepted", "failed", "submitted", "pending"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors ${
              statusFilter === s
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {isLoading ? <PageSpinner /> : (
        <>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice No</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Buyer</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">CUIN</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      No invoices found
                    </td>
                  </tr>
                ) : invoices.map((inv) => {
                  const statusCfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-data-mono text-slate-800">
                        {inv.internal_invoice_no}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {formatDate(inv.invoice_date)}
                      </td>
                      <td className="px-4 py-3 max-w-[150px] truncate" title={inv.buyer_name}>
                        <div className="font-medium text-slate-800 truncate">{inv.buyer_name}</div>
                        {inv.buyer_pin && (
                          <div className="text-xs text-slate-400 font-data-mono">{inv.buyer_pin}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 capitalize">
                        {inv.invoice_type === "platform_fee" ? "Platform Fee" : "Subscription"}
                      </td>
                      <td className="px-4 py-3 font-data-mono text-right text-slate-900">
                        {formatKES(inv.total_amount_kes)}
                      </td>
                      <td className="px-4 py-3 font-data-mono text-xs text-slate-500 max-w-[120px] truncate">
                        {inv.cu_invoice_no || (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                        {inv.retry_count > 0 && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            Retried {inv.retry_count}×
                          </div>
                        )}
                        {inv.status === "failed" && inv.last_error && (
                          <div
                            className="text-xs text-red-400 mt-0.5 max-w-[180px] truncate"
                            title={inv.last_error}
                          >
                            {inv.last_error}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {inv.status !== "accepted" && (
                          <button
                            type="button"
                            onClick={() => retryMutation.mutate(inv.id)}
                            disabled={retryMutation.isPending}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                          >
                            <RefreshCw className={`w-3 h-3 ${retryMutation.isPending ? "animate-spin" : ""}`} />
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
              <span>Page {page} of {totalPages} ({total} total)</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
