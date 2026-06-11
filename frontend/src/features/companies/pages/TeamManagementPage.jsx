import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Trash2, Mail, Shield, Eye, Wrench, Clock, X } from "lucide-react";
import { companiesApi } from "../api/companiesApi";
import { invitationsApi } from "@/features/auth/api/authApi";
import { useCompanyStore } from "@/store/companyStore";

const ROLE_META = {
  admin:  { label: "Admin",   icon: Shield,  color: "text-violet-700 bg-violet-50 border-violet-200" },
  ops:    { label: "Ops",     icon: Wrench,  color: "text-amber-700 bg-amber-50 border-amber-200" },
  viewer: { label: "Viewer",  icon: Eye,     color: "text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600" },
};

const inputCls = "w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-shadow";

function daysAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function TeamManagementPage() {
  const qc = useQueryClient();
  const { activeCompanyId } = useCompanyStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("viewer");
  const [inviteError, setInviteError] = useState(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["company-members", activeCompanyId],
    queryFn: () => companiesApi.listMembers(activeCompanyId),
    enabled: !!activeCompanyId,
  });

  const { data: pendingInvites = [] } = useQuery({
    queryKey: ["company-invites", activeCompanyId],
    queryFn: () => invitationsApi.listPending(activeCompanyId),
    enabled: !!activeCompanyId,
  });

  const inviteMut = useMutation({
    mutationFn: (data) => companiesApi.inviteMember(activeCompanyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-members", activeCompanyId] });
      qc.invalidateQueries({ queryKey: ["company-invites", activeCompanyId] });
      setEmail("");
      setInviteError(null);
    },
    onError: (err) => setInviteError(err.response?.data?.detail || "Invite failed"),
  });

  const removeMut = useMutation({
    mutationFn: (userId) => companiesApi.removeMember(activeCompanyId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-members", activeCompanyId] }),
  });

  const cancelInviteMut = useMutation({
    mutationFn: (inviteId) => invitationsApi.cancel(inviteId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-invites", activeCompanyId] }),
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    inviteMut.mutate({ email: email.trim(), role });
  };

  if (!activeCompanyId) {
    return <div className="text-slate-500 text-sm p-4">Create a company first to manage team members.</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Team Management</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Invite colleagues to access your company account.</p>
      </div>

      {/* Invite form */}
      <form onSubmit={handleInvite} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2"><UserPlus className="w-4 h-4 text-secondary" /> Invite a Member</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className={inputCls.replace("px-3", "pl-9")}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              <option value="admin">Admin — full control</option>
              <option value="ops">Ops — post loads, manage</option>
              <option value="viewer">Viewer — read-only</option>
            </select>
          </div>
        </div>
        {inviteError && <p className="text-xs text-red-600">{inviteError}</p>}
        <button type="submit" disabled={inviteMut.isPending} className="bg-secondary text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-60">
          {inviteMut.isPending ? "Inviting…" : "Send Invite"}
        </button>
      </form>

      {/* Active member list */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Team Members ({members.length})</p>
        </div>
        {isLoading ? (
          <div className="py-10 text-center text-slate-400 text-sm">Loading…</div>
        ) : members.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">No members yet. Invite someone above.</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {members.map((m) => {
              const meta = ROLE_META[m.role] || ROLE_META.viewer;
              const Icon = meta.icon;
              return (
                <li key={m.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {(m.full_name || m.email || "?").slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{m.full_name || "—"}</p>
                    <p className="text-xs text-slate-400 truncate">{m.email}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${meta.color}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                  <button
                    onClick={() => removeMut.mutate(m.user_id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove member"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Pending Invites ({pendingInvites.length})
            </p>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {pendingInvites.map((inv) => {
              const meta = ROLE_META[inv.company_member_role] || ROLE_META.viewer;
              const Icon = meta.icon;
              return (
                <li key={inv.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{inv.invitee_email}</p>
                    <p className="text-xs text-slate-400">Invited {daysAgo(inv.created_at)} · link expires in 7 days</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${meta.color}`}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                  <button
                    onClick={() => cancelInviteMut.mutate(inv.id)}
                    disabled={cancelInviteMut.isPending}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Cancel invite"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
