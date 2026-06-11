import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, Download, ExternalLink, XCircle } from "lucide-react";
import { paymentsApi } from "@/features/payments/api/paymentsApi";
import { PageSpinner } from "@/components/ui/Spinner";

const STATUS_CONFIG = {
  accepted: { label: "Accepted by KRA", color: "text-teal-600", icon: <CheckCircle className="w-4 h-4" /> },
  submitted: { label: "Submitted", color: "text-blue-500", icon: <Clock className="w-4 h-4" /> },
  pending:   { label: "Pending", color: "text-amber-500", icon: <Clock className="w-4 h-4" /> },
  failed:    { label: "Submission failed", color: "text-red-500", icon: <XCircle className="w-4 h-4" /> },
};

function formatKES(amount) {
  return `KES ${Number(amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}`;
}

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length < 8) return yyyymmdd;
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return `${d}/${m}/${y}`;
}

async function downloadPdf(invoice) {
  const blob = await paymentsApi.downloadReceiptPdf(invoice.id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trakvora-receipt-${invoice.internal_invoice_no}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EtimsReceiptsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["etims-invoices", page],
    queryFn: () => paymentsApi.getEtimsInvoices({ page, page_size: 20 }),
  });

  if (isLoading) return <PageSpinner />;

  const invoices = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">
          Tax Receipts
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          KRA eTIMS compliant tax invoices issued for platform fees and subscription charges.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-slate-400 text-lg mb-2">No tax receipts yet</div>
          <p className="text-sm text-slate-400">
            Receipts are generated automatically when platform fees or subscription charges are applied.
          </p>
        </div>
      ) : (
        <>
          <div className="card divide-y divide-slate-100 dark:divide-slate-700">
            {invoices.map((inv) => {
              const status = STATUS_CONFIG[inv.status] || STATUS_CONFIG.pending;
              return (
                <div key={inv.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-data-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {inv.internal_invoice_no}
                        </span>
                        <span className={`flex items-center gap-1 text-xs font-medium ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </span>
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        {inv.service_description}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-slate-400">
                        <span>Date: {formatDate(inv.invoice_date)}</span>
                        <span>Type: {inv.invoice_type === "platform_fee" ? "Platform Fee" : "Subscription"}</span>
                        {inv.cu_invoice_no && (
                          <span className="font-medium text-slate-500 dark:text-slate-400">
                            CUIN: {inv.cu_invoice_no}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-data-mono font-semibold text-slate-900 dark:text-white">
                        {formatKES(inv.total_amount_kes)}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        incl. KES {Number(inv.vat_amount_kes).toLocaleString("en-KE", { minimumFractionDigits: 2 })} VAT
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <button
                      type="button"
                      onClick={() => downloadPdf(inv)}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </button>
                    {inv.qr_code_url && (
                      <a
                        href={inv.qr_code_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Verify on KRA
                      </a>
                    )}
                    {inv.status === "failed" && inv.last_error && (
                      <span className="text-xs text-red-500 truncate max-w-xs" title={inv.last_error}>
                        {inv.last_error}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-slate-500 dark:text-slate-400">
              <span>Page {page} of {totalPages} ({total} receipts)</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          All receipts are generated in compliance with KRA eTIMS requirements and include
          16% VAT. The Control Unit Invoice Number (CUIN) can be used to verify authenticity
          on the KRA eTIMS portal.
        </p>
      </div>
    </div>
  );
}
