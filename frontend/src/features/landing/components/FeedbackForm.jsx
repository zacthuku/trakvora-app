import { useState } from "react";
import { Star, Send, CheckCircle } from "lucide-react";
import { feedbackApi } from "@/api/feedbackApi";

const ROLES = ["Shipper", "Fleet Owner", "Driver", "Logistics Manager", "Other"];

const FEEDBACK_TYPES = [
  "General",
  "Feature Request",
  "Bug Report",
  "Payment Issue",
  "Integration",
  "Onboarding",
  "Performance",
  "Other",
];

const INPUT_CLS = "w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#fe6a34]/30 focus:border-[#fe6a34]";
const SELECT_CLS = `${INPUT_CLS} bg-white`;

export default function FeedbackForm() {
  const [form, setForm] = useState({
    name: "", email: "", company_name: "", role: "", feedback_type: "", message: "", rating: 0,
  });
  const [hover, setHover]       = useState(0);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error, setError]       = useState("");

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setError("Name, email and message are required.");
      return;
    }
    setLoading(true);
    try {
      await feedbackApi.submit({
        name:          form.name,
        email:         form.email,
        company_name:  form.company_name  || null,
        role:          form.role          || null,
        feedback_type: form.feedback_type || null,
        message:       form.message,
        rating:        form.rating        || null,
      });
      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        <h3 className="font-heading text-2xl font-bold text-slate-900 mb-2">Thank you!</h3>
        <p className="text-slate-500 max-w-sm">
          Your feedback has been submitted and routed to the right team. We really appreciate your time.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {/* Name */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name *</label>
        <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
          placeholder="Your full name" className={INPUT_CLS} />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email *</label>
        <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
          placeholder="you@company.com" className={INPUT_CLS} />
      </div>

      {/* Company */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Company <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input type="text" value={form.company_name} onChange={e => set("company_name", e.target.value)}
          placeholder="Your company name" className={INPUT_CLS} />
      </div>

      {/* Role */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Your role <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <select value={form.role} onChange={e => set("role", e.target.value)} className={SELECT_CLS}>
          <option value="">Select a role…</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Feedback type */}
      <div className="md:col-span-2">
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          Feedback type <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <select value={form.feedback_type} onChange={e => set("feedback_type", e.target.value)} className={SELECT_CLS}>
          <option value="">Select a type…</option>
          {FEEDBACK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {form.feedback_type && (
          <p className="mt-1.5 text-xs text-slate-400">
            {form.feedback_type === "Payment Issue" && "Your feedback will be sent to our finance team."}
            {(form.feedback_type === "Feature Request" || form.feedback_type === "Integration" || form.feedback_type === "Bug Report" || form.feedback_type === "Performance") && "Your feedback will be sent to our product & engineering team."}
            {(form.feedback_type === "General" || form.feedback_type === "Onboarding" || form.feedback_type === "Other") && "Your feedback will be sent to our support team."}
          </p>
        )}
      </div>

      {/* Message */}
      <div className="md:col-span-2">
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Your feedback *</label>
        <textarea value={form.message} onChange={e => set("message", e.target.value)} rows={4}
          placeholder="Tell us about your experience with trakvora…"
          className={`${INPUT_CLS} resize-none`} />
      </div>

      {/* Star rating */}
      <div className="md:col-span-2">
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Rating <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(star => (
            <button key={star} type="button"
              onClick={() => set("rating", star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="p-0.5 focus:outline-none">
              <Star className="w-7 h-7 transition-colors"
                fill={(hover || form.rating) >= star ? "#fe6a34" : "none"}
                color={(hover || form.rating) >= star ? "#fe6a34" : "#cbd5e1"} />
            </button>
          ))}
        </div>
      </div>

      {error && <p className="md:col-span-2 text-sm text-red-500">{error}</p>}

      <div className="md:col-span-2">
        <button type="submit" disabled={loading}
          className="inline-flex items-center gap-2 bg-[#fe6a34] hover:bg-orange-500 disabled:opacity-60 text-white font-bold px-8 py-3 rounded-xl text-sm transition-colors shadow-lg shadow-orange-500/20">
          <Send className="w-4 h-4" />
          {loading ? "Sending…" : "Submit Feedback"}
        </button>
      </div>
    </form>
  );
}
