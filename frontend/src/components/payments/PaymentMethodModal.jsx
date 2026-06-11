import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X, Smartphone, Building2, CheckCircle, AlertCircle, Copy, Loader2 } from "lucide-react";
import apiClient from "@/services/apiClient";
import { useCurrency } from "@/hooks/useCurrency";

export default function PaymentMethodModal({ open, onClose, amount, currency, invoiceId, onSuccess }) {
  const { formatDirect } = useCurrency();
  const [selected, setSelected] = useState(null);
  const [account, setAccount] = useState("");
  const [accountName, setAccountName] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const { data: methods = [], isLoading: methodsLoading } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: () => apiClient.get("/payments/methods").then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const collectMut = useMutation({
    mutationFn: () =>
      apiClient
        .post(`/commissions/${invoiceId}/collect`, {
          method_id: selected.id,
          account,
          account_name: accountName || undefined,
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      setResult(data);
      if (data.status !== "instructions") {
        setTimeout(() => {
          onSuccess?.();
          handleClose();
        }, 4000);
      }
    },
  });

  const handleClose = () => {
    setSelected(null);
    setAccount("");
    setAccountName("");
    setResult(null);
    setCopied(false);
    onClose();
  };

  const copyRef = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">Pay Commission</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Amount: <span className="font-semibold text-slate-800 dark:text-white">{formatDirect(amount, currency)}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Success / Instructions state */}
          {result ? (
            result.status === "pending" ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-teal-600" />
                </div>
                <p className="font-semibold text-slate-900 dark:text-white">{result.message}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Confirm on your phone to complete payment.</p>
              </div>
            ) : (
              /* Bank instructions */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 font-semibold text-sm">
                  <Building2 className="w-4 h-4" /> Bank Transfer Instructions
                </div>
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reference</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{result.reference}</span>
                      <button onClick={() => copyRef(result.reference)} className="p-0.5 text-slate-400 hover:text-slate-600">
                        {copied ? <CheckCircle className="w-3.5 h-3.5 text-teal-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount</span>
                    <span className="font-semibold text-slate-900 dark:text-white">{formatDirect(result.amount_kes, currency)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{result.instructions}</p>
                <button
                  onClick={handleClose}
                  className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              </div>
            )
          ) : (
            <>
              {/* Method selection */}
              {!selected ? (
                <>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">
                    Choose payment method
                  </p>
                  {methodsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                    </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {methods.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelected(m)}
                        className="flex items-center gap-2 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 hover:border-secondary hover:bg-secondary/5 transition-all text-left"
                      >
                        <span className="text-xl">{m.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{m.label}</p>
                          <p className="text-[10px] text-slate-400 capitalize">{m.type}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  )}
                </>
              ) : (
                /* Credential input */
                <div className="space-y-3">
                  <button
                    onClick={() => { setSelected(null); setAccount(""); setAccountName(""); collectMut.reset(); }}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ← Change method
                  </button>

                  <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-700">
                    <span className="text-xl">{selected.icon}</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">{selected.label}</span>
                  </div>

                  {/* trakvora's receiving account details */}
                  {(selected.recipient_account || selected.recipient_name) && (
                    <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl px-4 py-3 space-y-1">
                      <p className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                        {selected.type === "mobile" ? "Pay To" : "Transfer To"}
                      </p>
                      {selected.recipient_name && (
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{selected.recipient_name}</p>
                      )}
                      {selected.recipient_account && (
                        <p className="text-sm font-mono text-slate-700 dark:text-slate-200">{selected.recipient_account}</p>
                      )}
                    </div>
                  )}

                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {selected.field === "phone" ? "Your Phone Number" : "Your Account Number"}
                    <input
                      type="text"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                      placeholder={selected.field === "phone" ? "e.g. 0712 345 678" : "e.g. 0123456789"}
                      className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-secondary"
                    />
                  </label>

                  {selected.type === "bank" && (
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Your Account Name (optional)
                      <input
                        type="text"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="Name on your account"
                        className="mt-2 w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-secondary"
                      />
                    </label>
                  )}

                  {collectMut.isError && (
                    <div className="flex items-center gap-2 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {collectMut.error?.response?.data?.detail || "Payment initiation failed. Please try again."}
                    </div>
                  )}

                  <button
                    onClick={() => collectMut.mutate()}
                    disabled={!account.trim() || collectMut.isPending}
                    className="w-full py-3 rounded-xl bg-secondary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {collectMut.isPending
                      ? "Processing…"
                      : selected.field === "phone"
                      ? "Send Payment Request"
                      : "Get Bank Details"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
