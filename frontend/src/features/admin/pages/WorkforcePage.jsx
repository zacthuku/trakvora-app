import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Users2, Plus, UserCheck, Pencil } from "lucide-react";
import { adminApi } from "@/features/admin/api/adminApi";

const ROLE_FILTER_OPTIONS = [
  { value: "",                  label: "All Roles" },
  { value: "super_admin",       label: "Super Admin" },
  { value: "operations_admin",  label: "Operations Admin" },
  { value: "field_inspector",   label: "Field Inspector" },
  { value: "iot_technician",    label: "IoT Technician" },
  { value: "compliance_officer",label: "Compliance Officer" },
  { value: "support_agent",     label: "Support Agent" },
];

const ROLE_BADGE = {
  super_admin:        "bg-violet-900/40 text-violet-300 border-violet-700/40",
  operations_admin:   "bg-blue-900/40 text-blue-300 border-blue-700/40",
  field_inspector:    "bg-amber-900/40 text-amber-300 border-amber-700/40",
  iot_technician:     "bg-cyan-900/40 text-cyan-300 border-cyan-700/40",
  compliance_officer: "bg-green-900/40 text-green-300 border-green-700/40",
  support_agent:      "bg-slate-800 text-slate-400 border-slate-600",
};

const ROLE_LABELS = {
  super_admin:        "Super Admin",
  operations_admin:   "Operations Admin",
  field_inspector:    "Field Inspector",
  iot_technician:     "IoT Technician",
  compliance_officer: "Compliance Officer",
  support_agent:      "Support Agent",
};

export default function WorkforcePage() {
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const params = { page, limit: LIMIT };
  if (roleFilter) params.admin_role = roleFilter;

  const { data, isLoading } = useQuery({
    queryKey: ["workforce", params],
    queryFn: () => adminApi.listWorkforce(params),
    staleTime: 15_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="py-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-violet-400" />
          <div>
            <h1 className="text-xl font-bold text-white font-heading">Workforce</h1>
            <p className="text-xs text-slate-500 mt-0.5">{total} admin team member{total !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button onClick={() => navigate("/admin/workforce/assign")}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold font-heading uppercase tracking-widest transition-colors">
          <Plus className="w-4 h-4" /> Assign Role
        </button>
      </div>

      {/* Role filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ROLE_FILTER_OPTIONS.map(({ value, label }) => (
          <button key={value} onClick={() => { setRoleFilter(value); setPage(1); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold font-heading uppercase tracking-widest transition-colors ${
              roleFilter === value
                ? "bg-violet-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Member</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Role</th>
                <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest font-heading">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-slate-800">
                    <td colSpan={4} className="px-4 py-4"><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-12 text-slate-600">
                    <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No team members found</p>
                  </td>
                </tr>
              ) : (
                items.map((member) => (
                  <tr key={member.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-xs font-semibold text-white">{member.full_name}</p>
                      <p className="text-[10px] text-slate-500">{member.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {member.admin_role ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest font-heading ${ROLE_BADGE[member.admin_role] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
                          {ROLE_LABELS[member.admin_role] ?? member.admin_role}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">Platform Admin</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-widest font-heading ${
                        member.is_active
                          ? "bg-green-900/40 text-green-300 border-green-700/40"
                          : "bg-slate-800 text-slate-500 border-slate-700"
                      }`}>
                        {member.is_active ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigate("/admin/workforce/assign", { state: { user: member } })}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] font-bold font-heading transition-colors">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
            <p className="text-[11px] text-slate-500">{total} members</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs disabled:opacity-40">Prev</button>
              <span className="text-xs text-slate-400">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-xs disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
