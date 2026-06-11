import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { providerApi } from "@/features/provider/api/providerApi";
import { useAuthStore } from "@/store/authStore";
import { format, parseISO } from "date-fns";

const STATUS_TABS = [
  { value: "",           label: "All"         },
  { value: "accepted",   label: "Accepted"    },
  { value: "in_progress",label: "In Progress" },
  { value: "completed",  label: "Completed"   },
  { value: "cancelled",  label: "Cancelled"   },
];

const STATUS_BADGE = {
  accepted:    "bg-blue-900/50 text-blue-300 border-blue-700/50",
  in_progress: "bg-orange-900/50 text-orange-300 border-orange-700/50",
  completed:   "bg-green-900/50 text-green-300 border-green-700/50",
  cancelled:   "bg-red-900/50 text-red-300 border-red-700/50",
  pending:     "bg-slate-800 text-slate-400 border-slate-700",
};

function jobSummary(job, role) {
  if (role === "mover")
    return `${job.move_type ?? "move"} — ${job.origin_location ?? ""} → ${job.destination_location ?? ""}`;
  if (role === "air_freight")
    return `${job.port_of_origin ?? ""} → ${job.port_of_destination ?? ""}`;
  return `${job.pickup_location ?? ""} → ${job.dropoff_location ?? ""}`;
}

export default function MyJobsPage() {
  const user = useAuthStore(s => s.user);
  const [activeTab, setActiveTab] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["my-jobs", activeTab, page],
    queryFn: () => providerApi.getMyJobs({ job_status: activeTab || undefined, page, page_size: 20 }),
    refetchInterval: 30_000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20) || 1;

  function handleTabChange(val) {
    setActiveTab(val);
    setPage(1);
  }

  return (
    <div className="space-y-6 py-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-heading">My Jobs</h1>
        <p className="text-slate-400 text-sm mt-1">All bookings you have accepted</p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit overflow-x-auto">
        {STATUS_TABS.map(({ value, label }) => (
          <button key={value} onClick={() => handleTabChange(value)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg font-heading whitespace-nowrap transition-colors ${
              activeTab === value
                ? "bg-[#fe6a34] text-white"
                : "text-slate-400 hover:text-white"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-slate-500 text-sm">Loading jobs…</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-slate-400 text-sm">No jobs found.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-500 font-bold uppercase tracking-widest font-heading">
                  <th className="text-left px-5 py-3">Job</th>
                  <th className="text-left px-5 py-3">Price</th>
                  <th className="text-left px-5 py-3">Accepted</th>
                  <th className="text-left px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {items.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-slate-200 text-xs capitalize truncate max-w-xs">
                        {jobSummary(job, user?.role)}
                      </p>
                      <p className="text-slate-600 text-[10px] font-mono mt-0.5">{job.id?.slice(0, 8)}…</p>
                    </td>
                    <td className="px-5 py-3 text-slate-300 text-xs font-semibold whitespace-nowrap">
                      KES {(job.price_kes ?? 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">
                      {job.accepted_at ? format(parseISO(job.accepted_at), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider font-heading ${STATUS_BADGE[job.status] ?? STATUS_BADGE.pending}`}>
                        {job.status?.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
