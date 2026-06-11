import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, UserCog, Search, CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";
import { toast } from "@/components/ui/Toast";

const ADMIN_ROLE_OPTIONS = [
  { value: "super_admin",        label: "Super Admin",        desc: "Full platform access" },
  { value: "operations_admin",   label: "Operations Admin",   desc: "Tasks, workforce, trucks, shipments" },
  { value: "field_inspector",    label: "Field Inspector",    desc: "Physical vehicle inspections" },
  { value: "iot_technician",     label: "IoT Technician",     desc: "GPS device installation" },
  { value: "compliance_officer", label: "Compliance Officer", desc: "Review and approve inspections" },
  { value: "support_agent",      label: "Support Agent",      desc: "Users, drivers, loads, shipments" },
];

const ROLE_BADGE = {
  admin:   "bg-violet-900/40 text-violet-300 border-violet-700/40",
  shipper: "bg-blue-900/40 text-blue-300 border-blue-700/40",
  driver:  "bg-amber-900/40 text-amber-300 border-amber-700/40",
  user:    "bg-slate-800 text-slate-400 border-slate-600",
};

export default function WorkforceAssignPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const passedUser = location.state?.user ?? null;

  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(passedUser);
  const [selectedRole, setSelectedRole] = useState(passedUser?.admin_role ?? "");
  const [error, setError] = useState(null);

  const { data, isFetching } = useQuery({
    queryKey: ["user-search", search],
    queryFn: () => adminApi.getUsers({ search, limit: 20 }),
    enabled: search.length >= 2,
    staleTime: 10_000,
  });

  const users = data?.items ?? [];

  const mutation = useMutation({
    mutationFn: () => {
      const payload = { user_id: selectedUser.id, admin_role: selectedRole };
      return selectedUser.role === "admin"
        ? adminApi.assignAdminRole(payload)
        : adminApi.promoteToAdmin(payload);
    },
    onSuccess: (res) => {
      const verb = selectedUser.role === "admin" ? "Role updated" : "User promoted to admin";
      toast(`${verb}: ${res.admin_role.replace(/_/g, " ")}`, "success");
      navigate("/admin/workforce");
    },
    onError: (e) => setError(e?.response?.data?.detail || "Operation failed"),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!selectedUser || !selectedRole) { setError("Select a user and a role"); return; }
    mutation.mutate();
  };

  const isPromotion = selectedUser && selectedUser.role !== "admin";

  return (
    <div className="max-w-lg mx-auto py-6 space-y-6">
      <button onClick={() => navigate("/admin/workforce")}
        className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Workforce
      </button>

      <div className="flex items-center gap-2">
        <UserCog className="w-5 h-5 text-violet-400" />
        <div>
          <h1 className="text-xl font-bold text-white font-heading">Add Team Member</h1>
          <p className="text-xs text-slate-500 mt-0.5">Search any user and assign an admin role</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User search */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Search User
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedUser(null); }}
              placeholder="Name or email…"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500"
            />
          </div>

          {/* Results */}
          {search.length >= 2 && (
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {isFetching ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-slate-800 rounded-lg animate-pulse" />
                ))
              ) : users.length === 0 ? (
                <p className="text-xs text-slate-500 py-2 text-center">No users found</p>
              ) : (
                users.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    onClick={() => { setSelectedUser(u); setSearch(""); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      selectedUser?.id === u.id
                        ? "bg-violet-900/40 border border-violet-600/50"
                        : "bg-slate-800 hover:bg-slate-700 border border-transparent"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-slate-300">
                        {u.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{u.full_name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest font-heading ${ROLE_BADGE[u.role] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
                      {u.role}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Selected user chip */}
          {selectedUser && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-violet-900/30 border border-violet-600/40 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-violet-900/60 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-violet-300">
                  {selectedUser.full_name?.charAt(0)?.toUpperCase() ?? "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{selectedUser.full_name}</p>
                <p className="text-[10px] text-slate-400 truncate">{selectedUser.email}</p>
              </div>
              {isPromotion ? (
                <span className="flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-900/30 border border-amber-700/40 px-2 py-0.5 rounded-full uppercase tracking-widest font-heading">
                  <ShieldCheck className="w-3 h-3" /> Will promote
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[9px] font-bold text-violet-300 bg-violet-900/30 border border-violet-700/40 px-2 py-0.5 rounded-full uppercase tracking-widest font-heading">
                  <UserCheck className="w-3 h-3" /> Update role
                </span>
              )}
              <button type="button" onClick={() => setSelectedUser(null)}
                className="text-slate-500 hover:text-white text-lg leading-none ml-1">×</button>
            </div>
          )}
        </div>

        {/* Role picker */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Admin Role
          </label>
          <div className="space-y-2">
            {ADMIN_ROLE_OPTIONS.map(({ value, label, desc }) => (
              <label key={value}
                className={`flex items-start gap-3 cursor-pointer p-3 rounded-xl border transition-colors ${
                  selectedRole === value
                    ? "bg-violet-900/30 border-violet-600/50"
                    : "bg-slate-800/50 border-slate-700/50 hover:border-slate-600"
                }`}>
                <input type="radio" name="admin_role" value={value}
                  checked={selectedRole === value} onChange={() => setSelectedRole(value)}
                  className="accent-violet-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white font-heading">{label}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button type="submit" disabled={!selectedUser || !selectedRole || mutation.isPending}
          className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold font-heading uppercase tracking-widest transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
          {mutation.isPending ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {isPromotion ? "Promoting…" : "Updating…"}</>
          ) : (
            <><CheckCircle2 className="w-4 h-4" />
              {isPromotion ? "Promote & Assign Role" : "Update Role"}</>
          )}
        </button>
      </form>
    </div>
  );
}
