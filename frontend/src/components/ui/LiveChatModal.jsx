import { X, MessageCircle, Clock, Mail } from "lucide-react";
import { useAuthStore } from "@/store/authStore";

const WHATSAPP_NUMBER = (import.meta.env.VITE_SUPPORT_WHATSAPP || "+254700000000").replace(/\D/g, "");

function isBusinessHours() {
  const now = new Date();
  const eatOffset = 3 * 60;
  const localOffset = now.getTimezoneOffset();
  const eatMs = now.getTime() + (eatOffset + localOffset) * 60 * 1000;
  const eat = new Date(eatMs);
  const day = eat.getDay();
  const hour = eat.getHours();
  return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
}

export default function LiveChatModal({ open, onClose, onLeaveMessage }) {
  const online = isBusinessHours();
  const user = useAuthStore((s) => s.user);

  if (!open) return null;

  const openWhatsApp = () => {
    const greeting = encodeURIComponent(
      `Hi Trakvora Support, I need help.\n\nName: ${user?.full_name || ""}\nRole: ${user?.role || ""}`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${greeting}`, "_blank");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
           style={{ maxHeight: "85vh" }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 bg-slate-900 dark:bg-slate-950 shrink-0">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-[#4fdbcc]/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-[#4fdbcc]" />
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${online ? "bg-green-400" : "bg-slate-500"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-none">Trakvora Support</p>
            <p className={`text-[10px] mt-0.5 ${online ? "text-green-400" : "text-slate-400"}`}>
              {online ? "Online · typical reply ~2 min" : "Offline · Mon–Fri 8am–6pm EAT"}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {online ? (
          /* Online — open WhatsApp */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center gap-5 bg-white dark:bg-slate-800">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
              {/* WhatsApp icon */}
              <svg viewBox="0 0 24 24" className="w-9 h-9 fill-green-500" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </div>
            <div>
              <p className="font-heading font-bold text-slate-900 dark:text-white text-base">Chat on WhatsApp</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                Our support team is online. Start a WhatsApp chat and we'll reply within minutes.
              </p>
            </div>
            <button
              onClick={openWhatsApp}
              className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              Open WhatsApp
            </button>
            <p className="text-[11px] text-slate-400">Opens WhatsApp with your details pre-filled</p>
          </div>
        ) : (
          /* Offline state */
          <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 text-center gap-5 bg-white dark:bg-slate-800">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              <Clock className="w-7 h-7 text-slate-400" />
            </div>
            <div>
              <p className="font-heading font-bold text-slate-900 dark:text-white text-base">We're currently offline</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
                Live chat is available <span className="font-semibold text-slate-700 dark:text-slate-200">Mon–Fri, 8am–6pm EAT</span>.
                Leave us a message and we'll reply within 24 hours.
              </p>
            </div>
            <div className="flex flex-col gap-2.5 w-full">
              {onLeaveMessage && (
                <button
                  onClick={() => { onClose(); onLeaveMessage(); }}
                  className="w-full py-2.5 bg-secondary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Leave a Message
                </button>
              )}
              <a
                href="mailto:support@trakvora.com"
                className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" /> Email Us
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
