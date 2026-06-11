import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import apiClient from "@/services/apiClient";
import SupportTicketList from "@/features/support/SupportTicketList";
import {
  HelpCircle, ChevronDown, ChevronUp, MessageCircle,
  Phone, Mail, FileQuestion, Zap, Truck, CreditCard,
  MapPin, Send, CheckCircle2, AlertCircle, ExternalLink,
  Clock, BookOpen,
} from "lucide-react";
import LiveChatModal from "@/components/ui/LiveChatModal";

const FAQS = [
  {
    category: "Fleet & Trucks",
    icon: Truck,
    color: "text-[#4fdbcc]",
    bg: "bg-teal-50",
    items: [
      {
        q: "How do I register a truck on trakvora?",
        a: "Go to Fleet Management → Register Truck. Enter the registration number, truck type, capacity, and optional details (make, model, year, GPS tracker ID). Once registered, the truck appears on your dashboard and in the telemetry map if it has a GPS tracker.",
      },
      {
        q: "Why is my truck showing as 'Idle' even though it's on the road?",
        a: "The status reflects what you set in the system. Go to Fleet Management, find the truck, and click 'Activate' to mark it as active. Live GPS status requires an integrated GPS tracker ID linked to your unit.",
      },
      {
        q: "Can I add a GPS tracker after registering a truck?",
        a: "Yes. Go to Fleet Management, click 'Edit' on any truck, and enter the GPS Tracker ID field. Once saved, the dashboard telemetry map will automatically pick up location pings from that tracker.",
      },
      {
        q: "How many trucks can I register on one account?",
        a: "There is no limit on fleet size during the Phase 1 MVP. Enterprise fleet plans with advanced reporting will be introduced in a future release.",
      },
    ],
  },
  {
    category: "Loads & Marketplace",
    icon: FileQuestion,
    color: "text-violet-600",
    bg: "bg-violet-50",
    items: [
      {
        q: "How do I claim a load from the marketplace?",
        a: "Go to Marketplace or Active Loads, find a load with status 'Available', and click 'Claim Load' or 'View Details'. You'll be taken to the load detail page where you can assign one of your trucks and accept the job.",
      },
      {
        q: "What happens after I claim a load?",
        a: "The load status moves to 'Assigned' and the shipper is notified. Your assigned truck will appear on their tracking view. You'll receive pickup instructions and the load will appear in your Active Loads page.",
      },
      {
        q: "Can I unclaim a load once I've taken it?",
        a: "You can cancel before the truck is dispatched for pickup. Contact support immediately if you need to release a claimed load. Penalties may apply depending on the time elapsed since claiming.",
      },
    ],
  },
  {
    category: "Payments & Wallet",
    icon: CreditCard,
    color: "text-secondary",
    bg: "bg-orange-50",
    items: [
      {
        q: "How does trakvora handle payment?",
        a: "Payment is secured and released to your wallet only after the shipper confirms delivery. This protects both parties and ensures fair payment on every completed delivery.",
      },
      {
        q: "How do I withdraw earnings from my wallet?",
        a: "Go to Wallet page and use the 'Withdraw' option. M-Pesa and bank transfer withdrawals are being rolled out in Phase 2. During Phase 1, balances accumulate and can be tracked in real-time.",
      },
      {
        q: "What is the trakvora platform fee?",
        a: "trakvora charges a 5% platform fee on each completed load transaction. This is deducted automatically before funds are released to your wallet, and is visible in your transaction history as 'platform_fee'.",
      },
    ],
  },
  {
    category: "Tracking & Navigation",
    icon: MapPin,
    color: "text-sky-600",
    bg: "bg-sky-50",
    items: [
      {
        q: "How does live tracking work for fleet owners?",
        a: "If your trucks have GPS tracker IDs registered, their coordinates are broadcast to the trakvora platform. The telemetry map on your dashboard shows live positions. Shippers can also see the assigned truck's location once the load is in transit.",
      },
      {
        q: "My trucks don't show on the telemetry map. What's wrong?",
        a: "Check that a GPS Tracker ID is entered for each truck (Fleet Management → Edit). If the tracker is registered but still not showing, contact support with your tracker model and we'll help configure the integration.",
      },
    ],
  },
];

const TICKET_CATEGORIES = [
  "Fleet & Trucks",
  "Load Claim Issue",
  "Payment / Wallet",
  "Account & Profile",
  "GPS / Tracking",
  "Technical Bug",
  "Other",
];

const PRIORITIES = ["Low", "Medium", "High: Blocking Operations"];

function FaqItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors gap-3"
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.q}</span>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 bg-slate-50 dark:bg-slate-700 border-t border-slate-100 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.a}</p>
        </div>
      )}
    </div>
  );
}

function FaqSection({ section }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = section.icon;
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((s) => !s)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <div className={`w-9 h-9 rounded-lg ${section.bg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${section.color}`} />
        </div>
        <span className="flex-1 text-left font-heading font-semibold text-slate-900 dark:text-white">{section.category}</span>
        <span className="text-xs text-slate-400">{section.items.length} questions</span>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-slate-400" />
          : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {expanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-4 space-y-2.5">
          {section.items.map((item, i) => <FaqItem key={i} item={item} />)}
        </div>
      )}
    </div>
  );
}

function TicketForm() {
  const [form, setForm] = useState({ category: "", priority: "Medium", subject: "", body: "", email: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitMutation = useMutation({
    mutationFn: () => apiClient.post("/support/tickets", {
      ticket_type: form.category,
      subject: form.subject,
      message: form.body,
      load_ref: null,
    }).then((r) => r.data),
    onSuccess: () => { setError(""); setSubmitted(true); },
    onError: () => setError("Failed to submit ticket. Please try again."),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.category || !form.subject || !form.body) {
      setError("Please fill in all required fields.");
      return;
    }
    submitMutation.mutate();
  };

  const inputCls =
    "w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 placeholder:text-slate-400";

  if (submitted) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-6 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-teal-500" />
        </div>
        <h3 className="font-heading font-bold text-slate-900 dark:text-white text-lg mb-2">Ticket Submitted</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto mb-6">
          Our support team will review your request and respond via email within 24 hours.
          A copy has been sent to {form.email || "your registered email"}.
        </p>
        <button
          onClick={() => { setSubmitted(false); setForm({ category: "", priority: "Medium", subject: "", body: "", email: "" }); }}
          className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Submit Another Ticket
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
        <h2 className="font-heading font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-secondary" />
          Open a Support Ticket
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Describe your issue and we'll respond within 24 hours.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Category *
            </label>
            <select value={form.category} onChange={set("category")} className={inputCls}>
              <option value="">Select category…</option>
              {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
              Priority
            </label>
            <select value={form.priority} onChange={set("priority")} className={inputCls}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            Subject *
          </label>
          <input
            value={form.subject} onChange={set("subject")} required
            placeholder="Brief description of your issue"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            Details *
          </label>
          <textarea
            value={form.body} onChange={set("body")} required
            rows={5}
            placeholder="Describe your issue in detail. Include truck registration numbers, load IDs, or screenshots if relevant."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">
            Reply-to Email (optional)
          </label>
          <input
            type="email" value={form.email} onChange={set("email")}
            placeholder="Defaults to your account email"
            className={inputCls}
          />
        </div>

        <button
          type="submit"
          disabled={submitMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Send className="w-4 h-4" /> {submitMutation.isPending ? "Sending…" : "Submit Ticket"}
        </button>
      </form>
    </div>
  );
}

export default function SupportPage() {
  const [tab, setTab] = useState("faq");
  const [chatOpen, setChatOpen] = useState(false);

  const handleEmail = (address) => {
    const subject = encodeURIComponent("Fleet Owner Support Request – Trakvora");
    const body = encodeURIComponent("Hello Trakvora Support Team,\n\nI need help with the following:\n\n");
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${address}&su=${subject}&body=${body}`, "_blank");
  };

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Support Center</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Find answers, report issues, and get in touch with our team.</p>
      </div>

      {/* Contact channels */}
      <LiveChatModal
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onLeaveMessage={() => setTab("ticket")}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#4fdbcc]/10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-teal-700" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-teal-50 text-teal-700">Online</span>
          </div>
          <div>
            <p className="font-heading font-semibold text-slate-900 dark:text-white">Live Chat</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Available Mon–Fri · 8am–6pm EAT</p>
          </div>
          <button onClick={() => setChatOpen(true)}
            className="mt-auto text-xs font-semibold text-secondary hover:opacity-80 transition-opacity flex items-center gap-1">
            Start Chat <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-violet-700" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-violet-50 text-violet-700">24h response</span>
          </div>
          <div>
            <p className="font-heading font-semibold text-slate-900 dark:text-white">Email Support</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">support@trakvora.com</p>
          </div>
          <button onClick={() => handleEmail("support@trakvora.com")}
            className="mt-auto text-xs font-semibold text-secondary hover:opacity-80 transition-opacity flex items-center gap-1">
            Send Email <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <Phone className="w-5 h-5 text-secondary" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-orange-50 text-secondary">Business hours</span>
          </div>
          <div>
            <p className="font-heading font-semibold text-slate-900 dark:text-white">Phone Support</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">+254 700 000 000 · Mon–Fri</p>
          </div>
          <a href="tel:+254700000000"
            className="mt-auto text-xs font-semibold text-secondary hover:opacity-80 transition-opacity flex items-center gap-1">
            Call Now <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Response time banner */}
      <div className="flex items-center gap-3 bg-slate-900 text-white rounded-xl px-5 py-4 mb-7">
        <Clock className="w-5 h-5 text-[#4fdbcc] shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Current Response Time: <span className="text-[#4fdbcc]">~2 hours</span></p>
          <p className="text-xs text-slate-400 mt-0.5">All systems operational · Last checked a few minutes ago</p>
        </div>
        <button className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1">
          Status Page <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1 mb-6 w-fit">
        {[
          { id: "faq",     label: "FAQ",         icon: BookOpen      },
          { id: "ticket",  label: "New Ticket",  icon: MessageCircle },
          { id: "history", label: "My Tickets",  icon: Clock         },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === id ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* FAQ */}
      {tab === "faq" && (
        <div className="space-y-4">
          {FAQS.map((section) => (
            <FaqSection key={section.category} section={section} />
          ))}
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm">
              Can't find an answer?{" "}
              <button onClick={() => setTab("ticket")} className="text-secondary font-semibold hover:opacity-80 transition-opacity">
                Open a ticket
              </button>
            </p>
          </div>
        </div>
      )}

      {/* Ticket form */}
      {tab === "ticket" && (
        <div className="max-w-2xl">
          <TicketForm />
        </div>
      )}

      {tab === "history" && (
        <div className="max-w-2xl">
          <SupportTicketList />
        </div>
      )}
    </div>
  );
}
