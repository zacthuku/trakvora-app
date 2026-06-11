import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Send, MessageSquare, Clock, CheckCircle2, AlertCircle, Loader } from "lucide-react";
import apiClient from "@/services/apiClient";

const STATUS_STYLE = {
  open:        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
  resolved:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
  closed:      "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

const TICKET_TYPES = [
  { value: "billing",              label: "Billing & Payments" },
  { value: "technical",            label: "Technical Issue"    },
  { value: "dispute",              label: "Dispute"            },
  { value: "general",              label: "General Query"      },
  { value: "partner_verification", label: "Partner Verification" },
];

const inputCls = "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500";

// ── Create Ticket Modal ────────────────────────────────────────────────────────
function CreateTicketModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ ticket_type: "general", subject: "", message: "", load_ref: "" });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (data) => apiClient.post("/support/tickets", data).then((r) => r.data),
    onSuccess: (data) => { onCreated(data); onClose(); },
    onError: (err) => setError(err?.response?.data?.detail || "Failed to submit ticket"),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">New Support Ticket</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form); }} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Type</label>
            <select value={form.ticket_type} onChange={set("ticket_type")} className={inputCls}>
              {TICKET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Subject *</label>
            <input value={form.subject} onChange={set("subject")} required minLength={3} maxLength={255} placeholder="Briefly describe your issue" className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Message *</label>
            <textarea value={form.message} onChange={set("message")} required minLength={10} rows={5} placeholder="Describe your issue in detail..." className={inputCls} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Load / Shipment Reference (optional)</label>
            <input value={form.load_ref} onChange={set("load_ref")} placeholder="e.g. SHP-001 or load ID" className={inputCls} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 px-4 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              {mutation.isPending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {mutation.isPending ? "Submitting…" : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Ticket Thread Modal ────────────────────────────────────────────────────────
function TicketThreadModal({ ticketId, onClose }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState("");

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["ticket-detail", ticketId],
    queryFn: () => apiClient.get(`/support/tickets/${ticketId}`).then((r) => r.data),
    enabled: !!ticketId,
    refetchInterval: 15_000,
  });

  const replyMut = useMutation({
    mutationFn: (body) => apiClient.post(`/support/tickets/${ticketId}/messages`, { body }).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ticket-detail", ticketId] }); setReply(""); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg">{ticket?.subject || "Loading…"}</h2>
            {ticket && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-slate-500">{ticket.ticket_number}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${STATUS_STYLE[ticket.status] ?? ""}`}>{ticket.status?.replace("_", " ")}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 max-h-[55vh] overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500"><Loader className="w-5 h-5 animate-spin" /></div>
          ) : (
            (ticket?.messages ?? []).map((msg) => {
              const isOwn = msg.sender_role !== "admin";
              return (
                <div key={msg.id} className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${isOwn ? "bg-secondary text-white rounded-br-sm" : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm"}`}>
                    <p>{msg.body}</p>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {msg.sender_name || "Support"} · {msg.created_at ? new Date(msg.created_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {ticket?.status !== "closed" && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Add a reply…"
              rows={2}
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-secondary resize-none bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
            <button
              onClick={() => reply.trim() && replyMut.mutate(reply.trim())}
              disabled={!reply.trim() || replyMut.isPending}
              className="px-4 py-2 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 self-end"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SupportTicketList() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate]     = useState(false);
  const [openTicketId, setOpenTicketId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => apiClient.get("/support/tickets?page_size=50").then((r) => r.data),
    staleTime: 30_000,
  });

  const tickets = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-800 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-secondary" /> My Tickets
          {tickets.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-xs font-bold">{tickets.length}</span>
          )}
        </h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> New Ticket
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-slate-400 text-sm"><Loader className="w-5 h-5 animate-spin mr-2" /> Loading tickets…</div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-sm gap-2">
          <MessageSquare className="w-8 h-8 opacity-30" />
          <p>No tickets yet. Click "New Ticket" to get help.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => setOpenTicketId(t.id)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-left transition-colors"
            >
              <div className="shrink-0 mt-0.5">
                {t.status === "resolved" || t.status === "closed"
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : <Clock className="w-4 h-4 text-amber-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{t.subject}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] font-mono text-slate-400">{t.ticket_number}</span>
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${STATUS_STYLE[t.status] ?? ""}`}>{t.status?.replace("_", " ")}</span>
                  <span className="text-[10px] text-slate-400">{t.ticket_type?.replace(/_/g, " ")}</span>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                {t.created_at ? new Date(t.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) : ""}
              </span>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTicketModal
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["my-tickets"] })}
        />
      )}
      {openTicketId && (
        <TicketThreadModal ticketId={openTicketId} onClose={() => setOpenTicketId(null)} />
      )}
    </div>
  );
}
