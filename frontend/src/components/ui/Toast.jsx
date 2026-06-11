import { CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

const toasts = [];
let listeners = [];

export function toast(message, type = "success") {
  const id = Date.now();
  const item = { id, message, type };
  toasts.push(item);
  listeners.forEach((fn) => fn([...toasts]));
  setTimeout(() => {
    const idx = toasts.findIndex((t) => t.id === id);
    if (idx > -1) {
      toasts.splice(idx, 1);
      listeners.forEach((fn) => fn([...toasts]));
    }
  }, 4000);
}

export function ToastContainer() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((fn) => fn !== setItems);
    };
  }, []);

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-teal-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
    warning: <AlertCircle className="w-4 h-4 text-amber-500" />,
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg px-4 py-3 min-w-[280px] animate-in slide-in-from-right"
        >
          {icons[item.type]}
          <span className="text-sm text-slate-700 dark:text-slate-200">{item.message}</span>
        </div>
      ))}
    </div>
  );
}
