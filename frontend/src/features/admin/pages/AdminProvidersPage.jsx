import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/features/admin/api/adminApi";
import { toast } from "@/components/ui/Toast";
import { ShieldCheck, ShieldAlert } from "lucide-react";

const TABS = [
  { value: "mover",          label: "Mover Companies"   },
  { value: "air_freight",    label: "Air Freight Agents" },
  { value: "parcel_carrier", label: "Parcel Carriers"    },
];

function StatusBadge({ verified }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider font-heading bg-green-900/50 text-green-300 border-green-700/50">
      <ShieldCheck className="w-3 h-3" /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider font-heading bg-yellow-900/50 text-yellow-300 border-yellow-700/50">
      <ShieldAlert className="w-3 h-3" /> Pending
    </span>
  );
}

export default function AdminProvidersPage() {
  const [activeRole, setActiveRole] = useState("mover");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-providers", activeRole, page],
    queryFn: () => adminApi.getProviders({ role: activeRole, page, page_size: 50 }),
    refetchInterval: 60_000,
  });

  const { mutate: verifyProvider, variables: verifyingId } = useMutation({
    mutationFn: ({ id, action }) =>
      action === "verify" ? adminApi.verifyProvider(id) : adminApi.unverifyProvider(id),
    onSuccess: (_, { action }) => {
      toast(`Provider ${action === "verify" ? "verified" : "unverified"}`, "success");
      queryClient.invalidateQueries({ queryKey: ["admin-providers"] });
    },
    onError: (err) => toast(err.response?.data?.detail ?? "Action failed", "error"),
  });

  function handleTabChange(val) {
    setActiveRole(val);
    setPage(1);
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50) || 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-heading">Service Providers</h1>
        <p className="text-slate-400 text-sm mt-1">Manage mover companies, air freight agents, and parcel carriers</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(({ value, label }) => (
          <button key={value} onClick={() => handleTabChange(value)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg font-heading whitespace-nowrap transition-colors ${
              activeRole === value ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No {activeRole.replace("_", " ")} providers registered yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-500 font-bold uppercase tracking-widest font-heading">
                  <th className="text-left px-5 py-3">Company</th>
                  <th className="text-left px-5 py-3">Contact</th>
                  <th className="text-left px-5 py-3">Country</th>
                  <th className="text-left px-5 py-3">Jobs</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Joined</th>
                  <th className="text-left px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {items.map((provider) => (
                  <tr key={provider.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-slate-200 text-xs font-semibold">{provider.company_name || provider.full_name}</p>
                      {provider.company_name && (
                        <p className="text-slate-500 text-[10px]">{provider.full_name}</p>
                      )}
                      {provider.bio && (
                        <p className="text-slate-600 text-[10px] mt-0.5 truncate max-w-[180px]">{provider.bio}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="text-slate-400 text-xs">{provider.email}</p>
                      <p className="text-slate-500 text-[10px]">{provider.phone}</p>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{provider.country}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{provider.total_jobs ?? 0}</td>
                    <td className="px-5 py-3"><StatusBadge verified={provider.is_verified} /></td>
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {provider.created_at ? new Date(provider.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => verifyProvider({ id: provider.id, action: provider.is_verified ? "unverify" : "verify" })}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border font-heading transition-colors ${
                          provider.is_verified
                            ? "border-slate-700 text-slate-400 hover:border-red-600 hover:text-red-400"
                            : "border-green-700 text-green-400 hover:bg-green-900/30"
                        }`}>
                        {provider.is_verified ? "Unverify" : "Verify"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-heading">
            Previous
          </button>
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-heading">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
