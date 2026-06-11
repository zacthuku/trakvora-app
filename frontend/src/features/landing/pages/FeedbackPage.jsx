import { MessageSquare } from "lucide-react";
import MainNav from "@/components/layout/MainNav";
import Footer from "@/components/layout/Footer";
import FeedbackForm from "@/features/landing/components/FeedbackForm";

export default function FeedbackPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 antialiased">
      <MainNav />

      {/* Hero strip */}
      <section className="bg-[#f3f8ff] py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#fe6a34]/10 text-[#fe6a34] text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full mb-5">
            <MessageSquare className="w-3.5 h-3.5" />
            Your voice
          </div>
          <h1 className="font-heading text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 leading-tight">
            Share your experience
          </h1>
          <p className="text-slate-500 text-lg max-w-lg mx-auto leading-relaxed">
            Tell us what's working, what's not, or what you'd love to see next.
            Every submission goes directly to the right team.
          </p>
        </div>
      </section>

      {/* Form card */}
      <section className="flex-1 py-14 px-6 bg-white">
        <div className="max-w-2xl mx-auto bg-white border border-slate-100 rounded-2xl shadow-sm p-8 md:p-10">
          <FeedbackForm />
        </div>
      </section>

      <Footer />
    </div>
  );
}
