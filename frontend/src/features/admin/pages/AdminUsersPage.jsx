import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, ShieldCheck, ShieldOff, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, UserCog, X, Fingerprint, ThumbsUp, ThumbsDown,
  Truck, PackagePlus, Wallet,
} from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/components/ui/Toast";
import PartnerBadge from "@/components/ui/PartnerBadge";
import apiClient from "@/services/apiClient";

const ROLE_BADGE = {
  shipper: "bg-blue-900/50 text-blue-300 border-blue-700/50",
  owner:   "bg-amber-900/50 text-amber-300 border-amber-700/50",
  driver:  "bg-green-900/50 text-green-300 border-green-700/50",
  admin:   "bg-violet-900/50 text-violet-300 border-violet-700/50",
};

const KYC_BADGE = {
  unverified: "bg-slate-800 text-slate-400 border-slate-700",
  pending:    "bg-amber-900/50 text-amber-300 border-amber-700/50",
  approved:   "bg-teal-900/50 text-teal-300 border-teal-700/50",
  rejected:   "bg-red-900/50 text-red-300 border-red-700/50",
};

const ADMIN_ROLE_OPTIONS = [
  { value: "super_admin",        label: "Super Admin",        desc: "Full platform access" },
  { value: "operations_admin",   label: "Operations Admin",   desc: "Tasks, workforce, trucks, shipments" },
  { value: "field_inspector",    label: "Field Inspector",    desc: "Physical vehicle inspections" },
  { value: "iot_technician",     label: "IoT Technician",     desc: "GPS device installation" },
  { value: "compliance_officer", label: "Compliance Officer", desc: "Review and approve inspections" },
  { value: "support_agent",      label: "Support Agent",      desc: "Users, drivers, loads, shipments" },
];

function Badge({ text, color }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest font-heading ${color}`}>
      {text}
    </span>
  );
}

function StarRating({ rating }) {
  const r = Math.round(rating ?? 0);
  return (
    <span className="text-xs text-amber-400 font-heading font-semibold">
      {"★".repeat(Math.min(r, 5))}{"☆".repeat(Math.max(0, 5 - r))}
      <span className="text-slate-500 ml-1">{(rating ?? 0).toFixed(1)}</span>
    </span>
  );
}

function MakeAdminModal({ user, onClose, onSuccess }) {
  const [selectedRole, setSelectedRole] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => adminApi.promoteToAdmin({ user_id: user.id, admin_role: selectedRole }),
    onSuccess: (res) => {
      toast(`${user.full_name} is now ${res.admin_role.replace(/_/g, " ")}`, "success");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      onSuccess();
    },
    onError: (e) => toast(e?.response?.data?.detail || "Failed to promote user", "error"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-violet-400" />
            <div>
              <p className="text-sm font-bold text-white font-heading">Make Admin</p>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[240px]">{user.full_name} · {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Role picker */}
        <div className="p-5 space-y-2 max-h-[60vh] overflow-y-auto">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Select Admin Role</p>
          {ADMIN_ROLE_OPTIONS.map(({ value, label, desc }) => (
            <label key={value}
              className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${
                selectedRole === value
                  ? "bg-violet-900/30 border-violet-600/50"
                  : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
              }`}>
              <input
                type="radio" name="modal_admin_role" value={value}
                checked={selectedRole === value} onChange={() => setSelectedRole(value)}
                className="accent-violet-500 mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm font-semibold text-white font-heading">{label}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm font-bold font-heading hover:border-slate-500 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={!selectedRole || mutation.isPending}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold font-heading transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {mutation.isPending
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Promoting…</>
              : <><CheckCircle2 className="w-4 h-4" /> Assign Role</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const isSuperAdmin = !currentUser?.admin_role || currentUser.admin_role === "super_admin";
  const canManageEscrow = isSuperAdmin || currentUser?.admin_role === "finance_admin";

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [kycFilter, setKycFilter] = useState("");
  const [makeAdminTarget, setMakeAdminTarget] = useState(null);
  const LIMIT = 15;

  const params = {
    page,
    limit: LIMIT,
    ...(search && { search }),
    ...(roleFilter && { role: roleFilter }),
    ...(activeFilter !== "" && { is_active: activeFilter === "true" }),
    ...(kycFilter && { kyc_status: kycFilter }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", params],
    queryFn: () => adminApi.getUsers(params),
    staleTime: 15_000,
  });

  const suspendMut = useMutation({
    mutationFn: (id) => adminApi.suspendUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const tierMut = useMutation({
    mutationFn: ({ id, tier }) =>
      apiClient.patch(`/admin/users/${id}/partner-tier`, { partner_tier: tier }).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast(`Partner tier updated to ${data.partner_tier}`, "success");
    },
  });

  const verifyMut = useMutation({
    mutationFn: (id) => adminApi.verifyUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const kycMut = useMutation({
    mutationFn: ({ id, approved, reason }) => adminApi.reviewKYC(id, approved, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const capabilityMut = useMutation({
    mutationFn: ({ id, payload }) => adminApi.updateCapabilities(id, payload),
    onSuccess: (_, { payload }) => {
      const changed = Object.keys(payload).map((k) => `${k}=${payload[k]}`).join(", ");
      toast(`Capabilities updated: ${changed}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast("Failed to update capabilities", "error"),
  });

  const escrowMut = useMutation({
    mutationFn: (id) => adminApi.toggleEscrowAccess(id),
    onSuccess: (data) => {
      toast(data.can_use_escrow ? "Premium Wallet/Escrow enabled" : "Premium Wallet/Escrow disabled");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast("Failed to update escrow access", "error"),
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const users = data?.items ?? [];

  return (
    <div className="py-8 space-y-6">
      {makeAdminTarget && (
        <MakeAdminModal
          user={makeAdminTarget}
          onClose={() => setMakeAdminTarget(null)}
          onSuccess={() => setMakeAdminTarget(null)}
        />
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white font-heading">User Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">{total} total users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2.5 focus:border-violet-500 outline-none"
        >
          <option value="">All Roles</option>
          <option value="shipper">Shipper</option>
          <option value="owner">Fleet Owner</option>
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2.5 focus:border-violet-500 outline-none"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Suspended</option>
        </select>
        <select
          value={kycFilter}
          onChange={(e) => { setKycFilter(e.target.value); setPage(1); }}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded-lg px-3 py-2.5 focus:border-violet-500 outline-none"
        >
          <option value="">All KYC</option>
          <option value="pending">KYC Pending</option>
          <option value="approved">KYC Approved</option>
          <option value="unverified">KYC Unverified</option>
          <option value="rejected">KYC Rejected</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">User</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Role</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Rating</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Trips</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Status</th>
                <th className="hidden md:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Verified</th>
                <th className="hidden lg:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">KYC</th>
                <th className="hidden md:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Joined</th>
                <th className="hidden xl:table-cell text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Tier</th>
                <th className="text-right px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="h-4 bg-slate-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-600">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-slate-300 font-heading">
                            {u.full_name?.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">{u.full_name}</p>
                          <p className="text-[10px] text-slate-500">{u.email}</p>
                          {u.company_name && (
                            <p className="text-[10px] text-slate-600">{u.company_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge text={u.role} color={ROLE_BADGE[u.role] ?? "bg-slate-800 text-slate-400 border-slate-700"} />
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3"><StarRating rating={u.rating} /></td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <span className="text-xs text-slate-300 font-heading font-semibold">{u.total_trips}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        text={u.is_active ? "Active" : "Suspended"}
                        color={u.is_active ? "bg-green-900/40 text-green-400 border-green-700/40" : "bg-red-900/40 text-red-400 border-red-700/40"}
                      />
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      {u.is_verified
                        ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                        : <XCircle className="w-4 h-4 text-slate-600" />}
                    </td>
                    <td className="hidden lg:table-cell px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${KYC_BADGE[u.kyc_status || "unverified"]}`}>
                        <Fingerprint className="w-2.5 h-2.5" />
                        {u.kyc_status || "unverified"}
                      </span>
                    </td>
                    {/* Partner tier badge + inline setter */}
                    {["owner", "driver", "mover", "air_freight", "parcel_carrier"].includes(u.role) && (
                      <td className="hidden xl:table-cell px-4 py-3">
                        <select
                          value={u.partner_tier ?? "standard"}
                          onChange={(e) => tierMut.mutate({ id: u.id, tier: e.target.value })}
                          className="text-[10px] bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-violet-500"
                        >
                          <option value="standard">Standard</option>
                          <option value="verified">Verified</option>
                          <option value="premium">Premium</option>
                        </select>
                      </td>
                    )}
                    {!["owner", "driver", "mover", "air_freight", "parcel_carrier"].includes(u.role) && (
                      <td className="hidden xl:table-cell px-4 py-3" />
                    )}
                    <td className="hidden md:table-cell px-4 py-3">
                      <span className="text-[10px] text-slate-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "2-digit" }) : "–"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {/* KYC Approve/Reject — for pending KYC users */}
                        {u.kyc_status === "pending" && (
                          <>
                            <button
                              onClick={() => kycMut.mutate({ id: u.id, approved: true })}
                              title="Approve KYC"
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-teal-400 transition-colors"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => kycMut.mutate({ id: u.id, approved: false, reason: "Manual review failed" })}
                              title="Reject KYC"
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {/* Make Admin — only super_admin, only for non-admins */}
                        {isSuperAdmin && u.role !== "admin" && (
                          <button
                            onClick={() => setMakeAdminTarget(u)}
                            title="Make Admin"
                            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-violet-900/30 hover:bg-violet-900/60 text-violet-400 hover:text-violet-200 text-[10px] font-bold font-heading border border-violet-800/50 transition-colors">
                            <UserCog className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Make Admin</span>
                          </button>
                        )}
                        {/* Capability toggles — super_admin only, non-admin users only */}
                        {isSuperAdmin && u.role !== "admin" && (
                          <>
                            <button
                              onClick={() => capabilityMut.mutate({ id: u.id, payload: { can_carry: !u.can_carry } })}
                              title={u.can_carry ? "Revoke Carrier Capability" : "Grant Carrier Capability (can bid & register trucks)"}
                              className={`p-1.5 rounded-lg transition-colors ${u.can_carry ? "text-amber-400 hover:text-amber-200 bg-amber-900/30 hover:bg-amber-900/50" : "text-slate-500 hover:text-amber-400 hover:bg-slate-700"}`}
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => capabilityMut.mutate({ id: u.id, payload: { can_ship: !u.can_ship } })}
                              title={u.can_ship ? "Revoke Shipping Capability" : "Grant Shipping Capability (can post loads)"}
                              className={`p-1.5 rounded-lg transition-colors ${u.can_ship ? "text-sky-400 hover:text-sky-200 bg-sky-900/30 hover:bg-sky-900/50" : "text-slate-500 hover:text-sky-400 hover:bg-slate-700"}`}
                            >
                              <PackagePlus className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {/* Escrow access toggle — finance_admin or super_admin, shippers only */}
                        {canManageEscrow && u.role === "shipper" && (
                          <button
                            onClick={() => escrowMut.mutate(u.id)}
                            title={u.can_use_escrow ? "Revoke Premium Wallet/Escrow" : "Enable Premium Wallet/Escrow (large-volume shipper)"}
                            className={`p-1.5 rounded-lg transition-colors ${u.can_use_escrow ? "text-emerald-400 hover:text-emerald-200 bg-emerald-900/30 hover:bg-emerald-900/50" : "text-slate-500 hover:text-emerald-400 hover:bg-slate-700"}`}
                          >
                            <Wallet className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {u.role !== "admin" && (
                          <>
                            <button
                              onClick={() => verifyMut.mutate(u.id)}
                              title={u.is_verified ? "Unverify" : "Verify"}
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-green-400 transition-colors"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => suspendMut.mutate(u.id)}
                              title={u.is_active ? "Suspend" : "Unsuspend"}
                              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <ShieldOff className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900">
          <p className="text-[11px] text-slate-500">
            Showing {users.length ? (page - 1) * LIMIT + 1 : 0}–{Math.min(page * LIMIT, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 min-w-[60px] text-center">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
