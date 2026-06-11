import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Star, BadgeCheck, BadgeX, Filter } from "lucide-react";
import apiClient from "@/services/apiClient";
import { toast } from "@/components/ui/Toast";

const feedbackAdminApi = {
  list:          ()               => apiClient.get("/feedback").then(r => r.data),
  toggleFeature: (id, featured)   => apiClient.patch(`/feedback/${id}/feature`, null, { params: { featured } }).then(r => r.data),
};

const TYPE_COLORS = {
  "Payment Issue":   "bg-rose-900/40 text-rose-300 border-rose-700/40",
  "Feature Request": "bg-violet-900/40 text-violet-300 border-violet-700/40",
  "Bug Report":      "bg-red-900/40 text-red-300 border-red-700/40",
  "Integration":     "bg-blue-900/40 text-blue-300 border-blue-700/40",
  "Performance":     "bg-amber-900/40 text-amber-300 border-amber-700/40",
  "General":         "bg-slate-800 text-slate-300 border-slate-700",
  "Onboarding":      "bg-teal-900/40 text-teal-300 border-teal-700/40",
  "Other":           "bg-slate-800 text-slate-400 border-slate-700",
};

const ALL_TYPES = ["All", "General", "Feature Request", "Bug Report", "Payment Issue", "Integration", "Onboarding", "Performance", "Other"];

function Stars({ rating }) {
  if (!rating) return <span className="text-slate-600 text-xs">—</span>;
  return (
    <span className="text-amber-400 text-sm tracking-tight font-semibold">
      {"★".repeat(rating)}{"☆".repeat(5 - rating)}
    </span>
  );
}

function TypeBadge({ type }) {
  const cls = TYPE_COLORS[type] ?? TYPE_COLORS["Other"];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-widest font-heading ${cls}`}>
      {type ?? "General"}
    </span>
  );
}

export default function AdminFeedbackPage() {
  const qc = useQueryClient();
  const [typeFilter, setTypeFilter] = useState("All");
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-feedback"],
    queryFn: feedbackAdminApi.list,
    staleTime: 30_000,
  });

  const featureMut = useMutation({
    mutationFn: ({ id, featured }) => feedbackAdminApi.toggleFeature(id, featured),
    onSuccess: (_, { featured }) => {
      qc.invalidateQueries({ queryKey: ["admin-feedback"] });
      toast(featured ? "Marked as testimonial" : "Removed from testimonials", "success");
    },
    onError: () => toast("Action failed", "error"),
  });

  const filtered = items.filter(fb => {
    if (showFeaturedOnly && !fb.is_featured) return false;
    if (typeFilter !== "All" && (fb.feedback_type ?? "General") !== typeFilter) return false;
    return true;
  });

  return (
    <div className="py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-heading">Customer Feedback</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {items.length} submission{items.length !== 1 ? "s" : ""} · {items.filter(f => f.is_featured).length} featured as testimonials
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-slate-400">
          <Filter className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold uppercase tracking-widest">Type</span>
        </div>
        {ALL_TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              typeFilter === t
                ? "bg-violet-600 border-violet-500 text-white"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
            }`}>
            {t}
          </button>
        ))}
        <button onClick={() => setShowFeaturedOnly(v => !v)}
          className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
            showFeaturedOnly
              ? "bg-amber-600/30 border-amber-500/50 text-amber-300"
              : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
          }`}>
          <Star className="w-3 h-3" />
          Testimonials only
        </button>
      </div>

      {isLoading ? (
        <p className="text-slate-500 text-sm py-8">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No feedback matches your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(fb => (
            <div key={fb.id}
              className={`bg-slate-900 border rounded-xl overflow-hidden transition-colors ${
                fb.is_featured ? "border-amber-500/40" : "border-slate-800"
              }`}>
              {/* Row header */}
              <div className="flex flex-wrap items-start gap-4 px-5 py-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-violet-600/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-black text-violet-300">
                    {fb.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Identity */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-white">{fb.name}</span>
                    {fb.company_name && (
                      <span className="text-xs text-slate-500">· {fb.company_name}</span>
                    )}
                    {fb.role && (
                      <span className="text-[10px] text-slate-600">{fb.role}</span>
                    )}
                    {fb.is_featured && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
                        <Star className="w-3 h-3 fill-amber-400" /> Testimonial
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <TypeBadge type={fb.feedback_type} />
                    <Stars rating={fb.rating} />
                    <span className="text-xs text-slate-600">
                      {fb.created_at ? new Date(fb.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === fb.id ? null : fb.id)}
                    className="text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg transition-colors">
                    {expanded === fb.id ? "Collapse" : "Read"}
                  </button>
                  {fb.is_featured ? (
                    <button
                      onClick={() => featureMut.mutate({ id: fb.id, featured: false })}
                      disabled={featureMut.isPending}
                      className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 border border-rose-700/40 hover:border-rose-500/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                      <BadgeX className="w-3.5 h-3.5" /> Remove testimonial
                    </button>
                  ) : (
                    <button
                      onClick={() => featureMut.mutate({ id: fb.id, featured: true })}
                      disabled={featureMut.isPending}
                      className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 border border-amber-700/40 hover:border-amber-500/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                      <BadgeCheck className="w-3.5 h-3.5" /> Feature as testimonial
                    </button>
                  )}
                </div>
              </div>

              {/* Message preview (always visible, truncated) */}
              <div className={`px-5 pb-4 ${expanded === fb.id ? "" : "line-clamp-2"}`}>
                <p className={`text-sm text-slate-400 leading-relaxed italic ${expanded !== fb.id ? "line-clamp-2" : ""}`}>
                  "{fb.message}"
                </p>
              </div>

              {/* Expanded footer */}
              {expanded === fb.id && (
                <div className="border-t border-slate-800 px-5 py-3 flex items-center gap-4 text-xs text-slate-600">
                  <span>Email: <span className="text-slate-400">{fb.email}</span></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
