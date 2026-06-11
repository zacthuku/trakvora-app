import { Link } from "react-router-dom";
import {
  UserCircle2, CheckCircle, ArrowRight, DollarSign, MapPin,
  Smartphone, Star, Shield, Zap, Clock, BarChart2, Truck,
} from "lucide-react";
import RoleCta from "@/components/ui/RoleCta";

const STEPS = [
  {
    step: "01",
    title: "Create Your Profile",
    desc: "Register with your licence details, truck type, and preferred routes. Verification takes under 24 hours.",
    icon: UserCircle2,
  },
  {
    step: "02",
    title: "Browse the Job Feed",
    desc: "See available loads filtered by your location, capacity, and preferred corridors. No middlemen.",
    icon: Zap,
  },
  {
    step: "03",
    title: "Accept & Hit the Road",
    desc: "Accept a job, confirm pickup, and update your status at each milestone directly from the app.",
    icon: Truck,
  },
  {
    step: "04",
    title: "Deliver & Get Paid",
    desc: "Confirm delivery with a digital POD. Your payment is settled directly with the shipper, with a full digital record of every job.",
    icon: DollarSign,
  },
];

const BENEFITS = [
  { icon: Zap,        title: "Instant Job Alerts",    desc: "Get notified the moment a load matching your route is posted." },
  { icon: DollarSign, title: "Transparent Earnings",  desc: "See pay rates upfront before accepting any job. No hidden cuts." },
  { icon: MapPin,     title: "Preferred Corridors",   desc: "Set your preferred routes and only see loads that fit your schedule." },
  { icon: Shield,     title: "Clear Payment Terms",    desc: "Pay rates are shown upfront before you accept any job. Delivery is confirmed digitally, giving you a clear record for payment." },
  { icon: Star,       title: "Build Your Reputation", desc: "Earn ratings and reviews that unlock better-paying loads over time." },
  { icon: Smartphone, title: "All in the App",        desc: "Job feed, status updates, documents, and wallet. One place." },
];

const WHAT_YOU_GET = [
  "Access to loads from a growing network of verified shippers",
  "Upfront pay rates, no negotiation games",
  "Digital consignment notes automatically generated",
  "Real-time route guidance and geofence check-ins",
  "Transparent earnings record for every completed job",
  "Backhaul matching, no more dead miles",
  "In-app support for any job issues",
  "Build a verified driver profile and rating",
];

export default function ForDriversPage() {
  return (
    <div className="bg-white">
      {/* ── Hero ── */}
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-secondary/40 bg-secondary/10 px-4 py-1.5 rounded-full mb-6">
            <UserCircle2 className="w-4 h-4 text-secondary" />
            <span className="text-xs font-bold font-heading tracking-widest uppercase text-secondary">For Drivers</span>
          </div>
          <h1 className="font-heading text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
            Drive More.<br />
            <span className="text-secondary">Earn More.</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            Find loads, track your earnings, and build a verified driving profile. All from one app. No middlemen. No empty trips.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <RoleCta to="/register?role=driver"
              className="bg-secondary text-white px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition-opacity rounded-xl">
              <UserCircle2 className="w-5 h-5" /> Create Driver Profile
            </RoleCta>
            <Link to="/jobs"
              className="border border-gray-300 text-gray-800 px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors rounded-xl">
              Browse Open Jobs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-14 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-3">How It Works for Drivers</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Start earning in four simple steps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ step, title, desc, icon: Icon }) => (
              <div key={step} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm relative">
                <div className="absolute -top-3 left-6 bg-secondary text-white text-xs font-black font-heading px-3 py-1 rounded-full tracking-wider">
                  {step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/5 flex items-center justify-center mb-5 mt-3">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-heading font-bold text-primary mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-14 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-3">Built for Drivers on the Go</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Tools that work as hard as you do, on the road and off it.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-4 p-6 rounded-xl border border-slate-200 hover:border-secondary/40 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-primary mb-1">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What You Get ── */}
      <section className="py-14 px-6 bg-primary text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Everything a Driver Needs,<br />
              <span className="text-secondary">One Platform</span>
            </h2>
            <p className="text-white/80 text-lg leading-relaxed mb-8">
              Stop chasing loads through WhatsApp groups and brokers. trakvora puts verified, well-paying jobs directly in your hands.
            </p>
            <RoleCta to="/register?role=driver"
              className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity rounded-xl">
              Join as a Driver <ArrowRight className="w-4 h-4" />
            </RoleCta>
          </div>
          <ul className="space-y-3">
            {WHAT_YOU_GET.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                <CheckCircle className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-6 bg-secondary text-white text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl font-bold mb-3">Ready to find your next load?</h2>
          <p className="text-white/70 mb-8">Find verified loads, build your reputation, and grow your driving career with trakvora.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <RoleCta to="/register?role=driver"
              className="inline-flex items-center gap-2 bg-white text-secondary px-10 py-4 font-heading font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity rounded-xl shadow-lg">
              Create Driver Profile <ArrowRight className="w-4 h-4" />
            </RoleCta>
            <Link to="/jobs"
              className="inline-flex items-center gap-2 border-2 border-white text-white px-10 py-4 font-heading font-bold text-sm uppercase tracking-wider hover:bg-white/10 transition-colors rounded-xl">
              Browse Open Jobs
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
