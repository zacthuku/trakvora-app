import { Link } from "react-router-dom";
import {
  Code2, Webhook, Plug, Database,
  CheckCircle, ArrowRight, Cpu, Globe,
  BarChart2, MapPin, FileText, Zap,
} from "lucide-react";

const ERP_LOGOS = ["SAP", "Oracle", "Microsoft Dynamics 365", "Odoo", "Sage", "Xero"];

const API_CAPABILITIES = [
  { icon: MapPin,    title: "Shipment Tracking",  desc: "Query live position, status, and ETA for any active shipment on the platform." },
  { icon: Database,  title: "Loads & Trucks",     desc: "Create, update, and query loads, trucks, and bid activity programmatically." },
  { icon: BarChart2, title: "Reports & Analytics",desc: "Pull shipment history, lane performance, and commission summaries via REST." },
  { icon: FileText,  title: "Documents",          desc: "Retrieve consignment notes, PODs, and eTIMS receipts for any completed delivery." },
];

const WEBHOOK_EVENTS = [
  { event: "shipment.created",       desc: "A new shipment has been assigned to a carrier." },
  { event: "shipment.in_transit",    desc: "Carrier has marked the load as picked up and in motion." },
  { event: "shipment.pod_uploaded",  desc: "Proof of delivery document has been attached." },
  { event: "shipment.delivered",     desc: "Delivery confirmed. Final status and timestamps available." },
  { event: "load.bid_received",      desc: "A new bid has been placed on one of your loads." },
  { event: "truck.location_updated", desc: "Position ping received from a tracked vehicle." },
];

const EXAMPLE_PAYLOAD = `{
  "event": "shipment.in_transit",
  "timestamp": "2026-06-04T08:32:11Z",
  "data": {
    "shipment_id": "SHP-00841",
    "load_ref": "LD-2291",
    "status": "in_transit",
    "carrier": "Kamau Logistics Ltd",
    "location": { "lat": -1.286, "lng": 36.817 },
    "eta_hours": 6.2
  }
}`;

const TRACKING_STEPS = [
  {
    step: "01",
    title: "Send Location Pings",
    desc: "POST GPS coordinates from your hardware or software tracker to the Trakvora Tracking API endpoint.",
    icon: Cpu,
  },
  {
    step: "02",
    title: "Trakvora Processes Position",
    desc: "The platform updates the live map, recalculates ETA, and fires alerts for geofence events.",
    icon: MapPin,
  },
  {
    step: "03",
    title: "Your Customers See It",
    desc: "Shippers and owners on Trakvora see the live position on their dashboards, exactly as if using native tracking.",
    icon: Globe,
  },
];

export default function ForDevelopersPage() {
  return (
    <div className="bg-white">

      {/* ── Hero ── */}
      <section className="bg-slate-900 text-white py-16 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <span className="inline-block bg-orange-500/20 text-orange-400 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-5">
            Developers & Integrations
          </span>
          <h1 className="font-heading text-4xl md:text-5xl font-black mb-4 leading-tight">
            Build on Trakvora
          </h1>
          <p className="text-slate-300 text-lg max-w-2xl mx-auto mb-8">
            Already have tracking hardware? Running your own TMS or ERP? Connect your systems to Trakvora's platform and get live freight data, event webhooks, and full API access.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/book-demo"
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-7 py-3 rounded-xl text-sm transition-colors">
              Request API Access
            </Link>
            <Link to="/help#contact"
              className="border border-white/20 text-white hover:bg-white/10 font-semibold px-7 py-3 rounded-xl text-sm transition-colors">
              Talk to an Engineer
            </Link>
          </div>
        </div>
      </section>

      {/* ── Tracking API ── */}
      <section id="tracking" className="py-14 px-6 bg-white scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-500/10 rounded-xl flex items-center justify-center shrink-0">
              <Cpu className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-blue-500">Tracking API</p>
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Have your own tracker? Plug it in.
          </h2>
          <p className="text-slate-500 text-sm mb-10 max-w-2xl">
            If you run a fleet with your own GPS devices or software tracker, you don't need to swap hardware. Send location pings to Trakvora and your vehicles will appear live on every shipper's and owner's dashboard.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            {TRACKING_STEPS.map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="relative">
                <div className="text-4xl font-black text-slate-100 font-heading mb-3">{step}</div>
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-blue-500" />
                </div>
                <h3 className="font-heading font-bold text-slate-900 mb-1 text-sm">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              REST API
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              HTTPS POST · JSON
            </span>
            <span className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-bold px-4 py-2 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
              API Key Auth
            </span>
          </div>
        </div>
      </section>

      {/* ── Webhooks ── */}
      <section id="webhooks" className="py-14 px-6 bg-slate-50 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-purple-500/10 rounded-xl flex items-center justify-center shrink-0">
              <Webhook className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-purple-500">Webhooks</p>
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Get real-time events pushed to your systems.
          </h2>
          <p className="text-slate-500 text-sm mb-10 max-w-2xl">
            Subscribe to Trakvora webhook events and receive delivery milestones, bid activity, and tracking updates directly in your own platform, ERP, or data warehouse — no polling required.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Event list */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Available Events</p>
              <div className="space-y-3">
                {WEBHOOK_EVENTS.map(({ event, desc }) => (
                  <div key={event} className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <code className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">{event}</code>
                      <p className="text-slate-500 text-xs mt-1">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Example payload */}
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Example Payload</p>
              <pre className="bg-slate-900 text-emerald-400 text-xs font-mono p-5 rounded-2xl leading-relaxed overflow-x-auto">
                {EXAMPLE_PAYLOAD}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* ── ERP Integrations ── */}
      <section id="integrations" className="py-14 px-6 bg-white scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center shrink-0">
              <Plug className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-orange-500">ERP & System Integrations</p>
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Sync freight data with your existing stack.
          </h2>
          <p className="text-slate-500 text-sm mb-10 max-w-2xl">
            Connect Trakvora to your finance or operations platform. Shipment costs, delivery confirmations, and commission records flow directly into the tools your team already uses.
          </p>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-8">
            {ERP_LOGOS.map((name) => (
              <div key={name}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-4 flex items-center justify-center hover:border-slate-300 hover:shadow-sm transition-all">
                <span className="text-xs font-bold text-slate-600 text-center leading-tight">{name}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-slate-400 font-medium">+ More connectors being added. <Link to="/help#contact" className="text-orange-500 hover:underline">Request yours</Link>.</p>
        </div>
      </section>

      {/* ── REST API ── */}
      <section id="api" className="py-14 px-6 bg-slate-50 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-emerald-600">REST API</p>
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-bold text-slate-900 mb-3">
            Full programmatic access to the platform.
          </h2>
          <p className="text-slate-500 text-sm mb-10 max-w-2xl">
            Query and manage every resource on Trakvora — shipments, loads, trucks, bids, reports, and documents — via a clean REST API with predictable JSON responses.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {API_CAPABILITIES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 bg-white border border-slate-200 rounded-2xl p-5">
                <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 text-sm mb-1">{title}</div>
                  <div className="text-slate-500 text-sm">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-6 bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <Zap className="w-8 h-8 text-orange-400 mx-auto mb-4" />
          <h2 className="font-heading text-2xl md:text-3xl font-bold mb-3">
            Ready to integrate?
          </h2>
          <p className="text-slate-400 text-sm mb-8">
            API access is available to verified fleet owners, shippers, and enterprise accounts. Reach out and our team will get you set up.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/book-demo"
              className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-7 py-3 rounded-xl text-sm transition-colors flex items-center gap-2">
              Request API Access <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/help#contact"
              className="border border-white/20 text-white hover:bg-white/10 font-semibold px-7 py-3 rounded-xl text-sm transition-colors">
              Talk to an Engineer
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
