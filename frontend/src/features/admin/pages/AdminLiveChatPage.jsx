import { ExternalLink } from "lucide-react";

const WHATSAPP_NUMBER = (import.meta.env.VITE_SUPPORT_WHATSAPP || "+254700000000").replace(/\D/g, "");
const WHATSAPP_DISPLAY = import.meta.env.VITE_SUPPORT_WHATSAPP || "+254 700 000 000";

export default function AdminLiveChatPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-white">Live Chat</h1>
        <p className="text-slate-400 text-sm mt-1">Users contact support via WhatsApp. Respond from the WhatsApp Business app or WhatsApp Web.</p>
      </div>

      {/* WhatsApp card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-start gap-5">
        <div className="w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-8 h-8 fill-green-400" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <div className="flex-1">
          <p className="font-heading font-bold text-white text-base">WhatsApp Business</p>
          <p className="text-slate-400 text-sm mt-1">{WHATSAPP_DISPLAY}</p>
          <p className="text-slate-500 text-xs mt-2">Users click "Start Chat" on their support page and are connected to this number with their details pre-filled.</p>
          <div className="mt-4">
            <a
              href="https://web.whatsapp.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Open WhatsApp Web
            </a>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest font-heading">How it works</p>
        <ol className="space-y-2 text-sm text-slate-300">
          <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-violet-900/60 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>User clicks "Start Chat" on their support page</li>
          <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-violet-900/60 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>WhatsApp opens with their name and role pre-filled in the message</li>
          <li className="flex gap-3"><span className="w-5 h-5 rounded-full bg-violet-900/60 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>Support agent receives the message on the WhatsApp Business number and replies</li>
        </ol>
        <p className="text-xs text-slate-500 pt-1">To update the WhatsApp number, set <code className="text-violet-300 bg-slate-800 px-1 rounded">SUPPORT_WHATSAPP</code> in your environment variables.</p>
      </div>
    </div>
  );
}
