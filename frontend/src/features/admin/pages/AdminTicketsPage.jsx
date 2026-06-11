import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageSquare, Search, Filter, ChevronDown, X, Send,
  Loader, CheckCircle2, Clock, AlertCircle, User,
} from "lucide-react";
import apiClient from "@/services/apiClient";

const STATUS_STYLE = {
  open:        "bg-blue-900/30 text-blue-400 border-blue-800",
  in_progress: "bg-amber-900/30 text-amber-400 border-amber-800",
  resolved:    "bg-emerald-900/30 text-emerald-400 border-emerald-800",
  closed:      "bg-slate-800 text-slate-400 border-slate-700",
};

const PRIORITY_STYLE = {
  low:    "bg-slate-800 text-slate-400 border-slate-700",
  medium: "bg-blue-900/30 text-blue-400 border-blue-700",
  high:   "bg-amber-900/30 text-amber-400 border-amber-700",
  urgent: "bg-red-900/30 text-red-400 border-red-700",
};

// ── Ticket Detail Modal ────────────────────────────────────────────────────────
function TicketDetailModal({ ticketId, onClose }) {
  const qc = useQueryClient();
  const [reply, setReply]   = useState("");
  const [note, setNote]     = useState("");
  const [noteMode, setNoteMode] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ["admin-ticket-detail", ticketId],
    queryFn: () => apiClient.get(`/support/tickets/${ticketId}`).then((r) => r.data),
    enabled: !!ticketId,
    refetchInterval: 20_000,
  });

  const replyMut = useMutation({
    mutationFn: ({ body, is_internal }) =>
      apiClient.post(`/support/tickets/${ticketId}/messages`, { body, is_internal }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ticket-detail", ticketId] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      setReply(""); setNote("");
    },
  });

  const updateMut = useMutation({
    mutationFn: (patch) =>
      apiClient.patch(`/support/admin/tickets/${ticketId}`, patch).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-ticket-detail", ticketId] });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div>
            <h2 className="font-heading font-bold text-white text-base">{ticket?.subject || "Loading…"}</h2>
            {ticket && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs font-mono text-slate-500">{ticket.ticket_number}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${STATUS_STYLE[ticket.status] ?? ""}`}>{ticket.status?.replace("_", " ")}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${PRIORITY_STYLE[ticket.priority] ?? ""}`}>{ticket.priority}</span>
                <span className="text-[10px] text-slate-500">{ticket.user_name} · {ticket.user_email}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        {/* Status controls */}
        {ticket && (
          <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-slate-800">
            {["open", "in_progress", "resolved", "closed"].map((s) => (
              <button
                key={s}
                onClick={() => updateMut.mutate({ status: s })}
                disabled={ticket.status === s || updateMut.isPending}
                className={`px-3 py-1 rounded-lg text-[10px] font-bold border uppercase tracking-widest transition-colors disabled:opacity-40 ${ticket.status === s ? STATUS_STYLE[s] : "bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700"}`}
              >
                {s.replace("_", " ")}
              </button>
            ))}
            <select
              value={ticket.priority ?? "medium"}
              onChange={(e) => updateMut.mutate({ priority: e.target.value })}
              className="ml-auto px-2 py-1 bg-slate-800 border border-slate-700 rounded-lg text-[10px] text-slate-400 focus:outline-none"
            >
              {["low", "medium", "high", "urgent"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}

        {/* Thread */}
        <div className="px-6 py-4 max-h-[45vh] overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500"><Loader className="w-5 h-5 animate-spin" /></div>
          ) : (
            (ticket?.messages ?? []).map((msg) => {
              const isAdmin = msg.sender_role === "admin";
              if (msg.is_internal) {
                return (
                  <div key={msg.id} className="flex items-start gap-2">
                    <div className="bg-slate-800 border border-slate-700 border-dashed rounded-xl px-4 py-2.5 text-xs text-slate-400 italic max-w-[90%]">
                      <span className="font-semibold text-slate-500 mr-1">Internal note:</span>{msg.body}
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id} className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${isAdmin ? "bg-violet-600 text-white rounded-br-sm" : "bg-slate-800 text-slate-100 rounded-bl-sm"}`}>
                    <p>{msg.body}</p>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 px-1">
                    {msg.sender_name || "Support"} · {msg.created_at ? new Date(msg.created_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Reply / internal note input */}
        <div className="px-6 py-4 border-t border-slate-800 space-y-3">
          <div className="flex gap-2 text-xs font-semibold">
            <button onClick={() => setNoteMode(false)} className={`px-3 py-1 rounded-lg transition-colors ${!noteMode ? "bg-violet-600 text-white" : "text-slate-500 hover:text-slate-300"}`}>Reply to user</button>
            <button onClick={() => setNoteMode(true)} className={`px-3 py-1 rounded-lg transition-colors ${noteMode ? "bg-slate-700 text-amber-400" : "text-slate-500 hover:text-slate-300"}`}>Internal note</button>
          </div>
          <div className="flex gap-2">
            <textarea
              value={noteMode ? note : reply}
              onChange={(e) => noteMode ? setNote(e.target.value) : setReply(e.target.value)}
              placeholder={noteMode ? "Add an internal note (user won't see this)…" : "Type your reply…"}
              rows={2}
              className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none resize-none bg-slate-800 text-slate-100 focus:border-violet-500 ${noteMode ? "border-slate-600 border-dashed" : "border-slate-700"}`}
            />
            <button
              onClick={() => {
                const body = noteMode ? note : reply;
                if (body.trim()) replyMut.mutate({ body: body.trim(), is_internal: noteMode });
              }}
              disabled={!(noteMode ? note : reply).trim() || replyMut.isPending}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 self-end"
            >
              <Send className="w-3.5 h-3.5" /> Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminTicketsPage() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-tickets", statusFilter, priorityFilter, page],
    queryFn: () => {
      const params = new URLSearchParams({ page, page_size: 20 });
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      return apiClient.get(`/support/admin/tickets?${params}`).then((r) => r.data);
    },
    staleTime: 15_000,
  });

  const tickets = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Support Tickets</h1>
        <p className="text-slate-400 text-sm mt-1">Manage user support requests — respond, escalate, resolve.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Open",        value: "open"        },
          { label: "In Progress", value: "in_progress" },
          { label: "Resolved",    value: "resolved"    },
          { label: "All",         value: ""            },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setStatusFilter(f.value); setPage(1); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === f.value ? "bg-violet-600 text-white border-violet-600" : "bg-slate-800 text-slate-400 border-slate-700 hover:border-violet-600 hover:text-violet-400"}`}
          >
            {f.label}
          </button>
        ))}
        <select
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-400 focus:outline-none focus:border-violet-500 ml-auto"
        >
          <option value="">All priorities</option>
          {["urgent", "high", "medium", "low"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Ticket table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500"><Loader className="w-5 h-5 animate-spin mr-2" /> Loading…</div>
        ) : tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-sm gap-2">
            <CheckCircle2 className="w-8 h-8 opacity-30" />
            <p>No tickets in this view.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {["Ticket #", "User", "Subject", "Type", "Priority", "Status", "Created"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => setOpenId(t.id)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-violet-400">{t.ticket_number}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-white font-medium">{t.user_name}</p>
                      <p className="text-[10px] text-slate-500">{t.user_email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 max-w-[200px] truncate">{t.subject}</td>
                    <td className="px-4 py-3 text-[10px] text-slate-400">{t.ticket_type?.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${PRIORITY_STYLE[t.priority] ?? ""}`}>{t.priority}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest ${STATUS_STYLE[t.status] ?? ""}`}>{t.status?.replace("_", " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-slate-500">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short" }) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">Showing {tickets.length} of {total}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs disabled:opacity-40 hover:bg-slate-700 transition-colors">
              Previous
            </button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page * 20 >= total}
              className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-xs disabled:opacity-40 hover:bg-slate-700 transition-colors">
              Next
            </button>
          </div>
        </div>
      </div>

      {openId && <TicketDetailModal ticketId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
