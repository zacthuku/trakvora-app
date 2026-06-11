import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import SupportTicketList from "@/features/support/SupportTicketList";
import apiClient from "@/services/apiClient";
import {
  HelpCircle, ChevronDown, ChevronUp, MessageCircle,
  Phone, Mail, PackagePlus, Gavel, CreditCard,
  Navigation2, Send, CheckCircle2, AlertCircle,
  ExternalLink, Clock, BookOpen, Truck, Shield,
} from "lucide-react";
import LiveChatModal from "@/components/ui/LiveChatModal";

const FAQS = [
  {
    category: "Posting Loads",
    icon: PackagePlus,
    color: "text-secondary",
    bg: "bg-orange-50",
    items: [
      {
        q: "How do I post a load on trakvora?",
        a: "Go to Post Load from the sidebar or dashboard. Enter your pickup and drop-off locations by name. Google Places autocomplete will resolve the coordinates. Set your cargo type, weight, and price, then publish. Your load will immediately appear on the carrier marketplace.",
      },
      {
        q: "How is the distance calculated?",
        a: "Distance is automatically calculated using a road factor applied to the straight-line distance between your pickup and drop-off coordinates. This gives a realistic road distance for East Africa routes. You can see it displayed in the form before submitting.",
      },
      {
        q: "What does the pickup schedule field do?",
        a: "Setting a pickup date and time window lets carriers plan their route accurately. The system calculates an estimated delivery time based on your distance and the selected pickup window. Drivers and fleet owners see this schedule when browsing loads.",
      },
      {
        q: "Can I edit or cancel a load after posting?",
        a: "You can cancel a load from the Active Loads page as long as it hasn't been booked yet. Once a carrier accepts and a shipment is created, contact support if you need to make changes. Cancelling at that stage may incur a fee.",
      },
      {
        q: "What cargo types are supported?",
        a: "trakvora supports all major freight categories: general cargo, dry goods, perishables (reefer), hazardous materials, bulk (tanker), machinery, livestock, and more. Select the type that best matches your cargo so carriers with appropriate trucks can bid.",
      },
    ],
  },
  {
    category: "Bids & Carriers",
    icon: Gavel,
    color: "text-violet-600",
    bg: "bg-violet-50",
    items: [
      {
        q: "How long does it take to receive bids?",
        a: "Most loads on active corridors (Nairobi–Mombasa, Nairobi–Kampala, etc.) receive their first bid within 30 minutes during business hours. Less common routes or very large loads may take longer. You'll receive a notification when new bids arrive.",
      },
      {
        q: "Can I negotiate with a carrier on their bid?",
        a: "Currently, bidding is fixed. Carriers submit their price and you accept or wait for a better offer. Counter-offer functionality is on the roadmap for Phase 2. For now, your best strategy is to set a competitive asking price to attract quality bids.",
      },
      {
        q: "What does accepting a bid do?",
        a: "When you accept a bid, a shipment record is created, the carrier's truck is assigned, and all other pending bids are automatically rejected. The carrier is notified and dispatched to your pickup location. Payment is released to the carrier after you confirm delivery.",
      },
      {
        q: "How do I choose the best bid?",
        a: "The Bid Comparison page sorts bids from lowest to highest price and highlights the 'Best Value' option. Read carrier messages for context on their experience or availability. Price is important, but a slightly higher bid from a proven carrier may be worth the premium.",
      },
    ],
  },
  {
    category: "Payments & Wallet",
    icon: CreditCard,
    color: "text-[#4fdbcc]",
    bg: "bg-teal-50",
    items: [
      {
        q: "How does trakvora protect my payments?",
        a: "When you confirm delivery, payment is released to the carrier. Until then, your funds are secure. If there is a delivery issue, contact support before confirming delivery so our team can assist you.",
      },
      {
        q: "How do I top up my wallet?",
        a: "Go to the Wallet page and use the Top Up option. You can fund your wallet via card or mobile money through IntaSend. Contact support if you need help with a manual top-up.",
      },
      {
        q: "What is the trakvora platform fee?",
        a: "trakvora charges a 5% service fee on completed deliveries, deducted automatically before payment is released to the carrier. As the shipper, you pay the agreed bid price with no hidden charges.",
      },
    ],
  },
  {
    category: "Tracking & Shipments",
    icon: Navigation2,
    color: "text-sky-600",
    bg: "bg-sky-50",
    items: [
      {
        q: "How do I track my shipment in real-time?",
        a: "Go to Live Tracking from the sidebar. All active shipments are listed with their current status and a progress bar. If the carrier's truck has a GPS tracker, you'll see live location updates. The page auto-refreshes every 30 seconds.",
      },
      {
        q: "What does each status mean?",
        a: "Posted: waiting for carrier bids. Booked: bid accepted, carrier confirmed. En Route: driver heading to your pickup. Loaded: cargo on the truck. In Transit: moving to destination. Delivered: arrived at drop-off.",
      },
      {
        q: "Can I contact the driver directly?",
        a: "Direct driver messaging is coming in Phase 2. For now, if you need to reach the carrier, use the support ticket form with your load ID and we'll relay the message urgently.",
      },
    ],
  },
];

const TICKET_CATEGORIES = [
  "Posting a Load",
  "Bid / Carrier Issue",
  "Payment / Wallet",
  "Tracking Issue",
  "Delivery Dispute",
  "Account & Profile",
  "Other",
];

const PRIORITIES = ["Low", "Medium", "High: Urgent / Blocking"];

function FaqItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((s) => !s)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors gap-3"
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
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
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
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
  const [form, setForm] = useState({
    category: "", priority: "Medium", subject: "", body: "", email: "", loadId: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submitMutation = useMutation({
    mutationFn: () => apiClient.post("/support/tickets", {
      ticket_type: form.category,
      subject: form.subject,
      message: form.body,
      load_ref: form.loadId || null,
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
          We'll respond within 24 hours. For urgent delivery disputes, our team typically responds within 2 hours during business hours.
        </p>
        <button
          onClick={() => { setSubmitted(false); setForm({ category: "", priority: "Medium", subject: "", body: "", email: "", loadId: "" }); }}
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
        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Describe your issue. Include your load ID for faster resolution.</p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Category *</label>
            <select value={form.category} onChange={set("category")} className={inputCls}>
              <option value="">Select…</option>
              {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Priority</label>
            <select value={form.priority} onChange={set("priority")} className={inputCls}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Load ID (if applicable)</label>
          <input value={form.loadId} onChange={set("loadId")}
            placeholder="e.g. TRK-A1B2C3D4 (helps us find your shipment fast)"
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Subject *</label>
          <input value={form.subject} onChange={set("subject")} required placeholder="Brief description" className={inputCls} />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Details *</label>
          <textarea
            value={form.body} onChange={set("body")} required rows={5}
            placeholder="What happened? When? Include any photos or evidence if relevant to a dispute."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Reply-to Email</label>
          <input type="email" value={form.email} onChange={set("email")}
            placeholder="Defaults to your account email"
            className={inputCls}
          />
        </div>

        <button type="submit"
          disabled={submitMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-secondary text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40">
          <Send className="w-4 h-4" /> {submitMutation.isPending ? "Sending…" : "Submit Ticket"}
        </button>
      </form>
    </div>
  );
}

export default function ShipperSupportPage() {
  const [tab, setTab] = useState("faq");
  const [chatOpen, setChatOpen] = useState(false);
  const navigate = useNavigate();

  const handleEmail = (address) => {
    const subject = encodeURIComponent("Support Request – Trakvora");
    const body = encodeURIComponent("Hello Trakvora Support Team,\n\nI need help with the following:\n\n");
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${address}&su=${subject}&body=${body}`, "_blank");
  };

  return (
    <div className="w-full">
      <div className="mb-7">
        <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white tracking-tight">Support Center</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Everything you need to ship with confidence on trakvora.</p>
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
            <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-teal-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-teal-50 text-teal-700">~2 min response</span>
          </div>
          <div>
            <p className="font-heading font-semibold text-slate-900 dark:text-white">Live Chat</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Mon–Fri · 8am–6pm EAT</p>
          </div>
          <button onClick={() => setChatOpen(true)}
            className="mt-auto text-xs font-semibold text-secondary hover:opacity-80 transition-opacity flex items-center gap-1">
            Start Chat <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-5 py-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-violet-600" />
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
              <Shield className="w-5 h-5 text-secondary" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-orange-50 text-secondary">Priority</span>
          </div>
          <div>
            <p className="font-heading font-semibold text-slate-900 dark:text-white">Dispute Hotline</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">For active delivery disputes</p>
          </div>
          <button onClick={() => navigate("/shipper/tracking")}
            className="mt-auto text-xs font-semibold text-secondary hover:opacity-80 transition-opacity flex items-center gap-1">
            Open Dispute <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Response time */}
      <div className="flex items-center gap-3 bg-slate-900 text-white rounded-xl px-5 py-4 mb-7">
        <Clock className="w-5 h-5 text-[#4fdbcc] shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">
            Current Response Time: <span className="text-[#4fdbcc]">~2 hours</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Delivery disputes are prioritised · all other tickets within 24 hours
          </p>
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
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === id ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "faq" && (
        <div className="space-y-4">
          {FAQS.map((section) => <FaqSection key={section.category} section={section} />)}
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm">
              Still stuck?{" "}
              <button onClick={() => setTab("ticket")}
                className="text-secondary font-semibold hover:opacity-80 transition-opacity">
                Open a ticket
              </button>
            </p>
          </div>
        </div>
      )}

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
