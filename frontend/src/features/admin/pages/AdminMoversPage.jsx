import { useQuery } from "@tanstack/react-query";
import { Truck } from "lucide-react";
import { adminApi } from "../api/adminApi";
import { useCurrency } from "@/hooks/useCurrency";

const STATUS_COLORS = {
  pending:   "bg-amber-900/40 text-amber-300 border-amber-700/40",
  confirmed: "bg-blue-900/40 text-blue-300 border-blue-700/40",
  completed: "bg-emerald-900/40 text-emerald-300 border-emerald-700/40",
  cancelled: "bg-rose-900/40 text-rose-300 border-rose-700/40",
};

export default function AdminMoversPage() {
  const { format } = useCurrency();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-move-requests"],
    queryFn: () => adminApi.listMoveRequests(),
  });
  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Truck className="w-5 h-5 text-violet-400" />
          <h1 className="text-2xl font-heading font-bold text-white">Mover Bookings</h1>
        </div>
        <p className="text-slate-400 text-sm">{items.length} booking{items.length !== 1 ? "s" : ""}</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-widest font-heading">
              <th className="text-left px-4 py-3">Move Type</th>
              <th className="text-left px-4 py-3">Route</th>
              <th className="text-left px-4 py-3">Move Date</th>
              <th className="text-left px-4 py-3">Price</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Loading…</td></tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3">
                  <span className="capitalize text-slate-300 text-xs font-medium">{item.move_type}</span>
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <p className="truncate text-white text-xs font-medium">{item.origin_location}</p>
                  <p className="truncate text-slate-500 text-xs">→ {item.destination_location}</p>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">{item.move_date ?? "—"}</td>
                <td className="px-4 py-3 text-slate-300 font-medium">{format(item.price_kes)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest ${STATUS_COLORS[item.status] ?? "bg-slate-800 text-slate-400 border-slate-700"}`}>
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No mover bookings yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
