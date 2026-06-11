import { Link } from "react-router-dom";
import {
  Receipt, CheckCircle, ArrowRight,
  FileCheck, ShieldCheck, Zap, Download, BarChart2, Building2,
  CreditCard, FileText, Send, Users,
} from "lucide-react";

const STEPS = [
  {
    step: "01",
    title: "You Subscribe or Transact",
    desc: "You pay for a trakvora subscription plan, or a commission is deducted from a completed freight payment.",
    icon: CreditCard,
  },
  {
    step: "02",
    title: "VAT Is Calculated",
    desc: "16% VAT is applied to the trakvora fee and clearly itemised on your invoice before any amount is charged.",
    icon: FileText,
  },
  {
    step: "03",
    title: "We File with KRA",
    desc: "trakvora submits the invoice to the KRA eTIMS portal in real-time via the official API — automatically, on your behalf.",
    icon: Send,
  },
  {
    step: "04",
    title: "You Get Your Receipt",
    desc: "A KRA-compliant e-receipt is sent to your dashboard and available as a downloadable PDF the moment it's issued.",
    icon: Users,
  },
];

const BENEFITS = [
  {
    icon: FileCheck,
    title: "KRA-Compliant Receipts",
    desc: "Every charge — subscription or commission — is accompanied by a valid eTIMS-signed KRA receipt.",
  },
  {
    icon: ShieldCheck,
    title: "VAT-Registered Platform",
    desc: "trakvora is a KRA-registered VAT business. Every receipt is valid for input VAT claims by B2B clients.",
  },
  {
    icon: Zap,
    title: "Instant Receipt Delivery",
    desc: "Receipts land in your billing dashboard within seconds of a charge — no waiting, no chasing.",
  },
  {
    icon: Download,
    title: "Download Anytime",
    desc: "Every receipt is archived permanently. Download PDFs for your accountant or KRA audit at any time.",
  },
  {
    icon: BarChart2,
    title: "Full Billing History",
    desc: "Filter receipts by date, plan type, or transaction — every charge is logged and exportable.",
  },
  {
    icon: Building2,
    title: "Supports B2B VAT Claims",
    desc: "Your KRA PIN appears on all receipts, so your business can claim back input VAT from KRA.",
  },
];

const WHAT_YOU_GET = [
  "16% VAT clearly itemised on every invoice",
  "KRA eTIMS-signed receipt for each subscription and commission charge",
  "Your KRA PIN included on all receipts (required for input VAT claims)",
  "PDF receipts downloadable from your billing dashboard at any time",
  "Email notification with receipt attached on every charge",
  "Monthly billing summary with all tax amounts",
  "Receipts accepted by KRA and your accountant",
  "No manual tax filing required on your end",
];

export default function EtimsPage() {
  return (
    <div className="bg-white">

      {/* ── Hero ── */}
      <section className="bg-[#f3f8ff] text-gray-900 py-14 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 border border-secondary/40 bg-secondary/10 px-4 py-1.5 rounded-full mb-6">
            <Receipt className="w-4 h-4 text-secondary" />
            <span className="text-xs font-bold font-heading tracking-widest uppercase text-secondary">KRA VAT Compliant</span>
          </div>
          <h1 className="font-heading text-4xl md:text-6xl font-extrabold mb-6 leading-tight tracking-tight">
            Every Fee You Pay Us<br />
            <span className="text-secondary">Comes With a KRA Receipt</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
            trakvora is a VAT-registered business. All subscription and commission fees include 16% VAT, which we file directly with KRA — and send you a compliant receipt every time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/pricing"
              className="bg-secondary text-white px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition-opacity rounded-xl">
              <Receipt className="w-5 h-5" /> View Pricing
            </Link>
            <Link to="/book-demo"
              className="border border-gray-300 text-gray-800 px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors rounded-xl">
              Book a Demo <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-8 mt-12 pt-10 border-t border-gray-200">
            <div className="text-center">
              <p className="font-heading text-3xl font-extrabold text-secondary">16%</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">VAT Included</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-3xl font-extrabold text-secondary">eTIMS</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">KRA Registered</p>
            </div>
            <div className="text-center">
              <p className="font-heading text-3xl font-extrabold text-secondary">Every</p>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">Charge Receipted</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-14 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-3">How eTIMS Works for You</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">From payment to KRA-signed receipt — fully automatic, every single time.</p>
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
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-3">Built for Tax Transparency</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">trakvora handles its own KRA obligations so you always have clean, auditable records for every fee you pay.</p>
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
      <section className="py-20 px-6 bg-primary text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
              Full Receipt Coverage,<br />
              <span className="text-secondary">On Every Single Charge</span>
            </h2>
            <p className="text-white/80 text-lg leading-relaxed mb-8">
              We pay our taxes properly — and give you the documentation to prove every fee you paid us was legitimate and KRA-compliant.
            </p>
            <Link to="/register"
              className="inline-flex items-center gap-2 bg-secondary text-white px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-opacity rounded-xl">
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Link>
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

      {/* ── Final CTA ── */}
      <section className="py-14 px-6 bg-slate-50 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-primary mb-4">
            Proper receipts.<br />
            <span className="text-secondary">Zero effort.</span>
          </h2>
          <p className="text-slate-500 text-lg mb-8">
            Every fee you pay trakvora comes with a KRA-stamped receipt — automatically, every time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register"
              className="bg-secondary text-white px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 transition-opacity rounded-xl">
              Get Started Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/pricing"
              className="border border-slate-300 text-primary px-8 py-4 font-heading font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 hover:border-primary/40 transition-colors rounded-xl">
              View Pricing
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
