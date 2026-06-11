import { create } from "zustand";
import { persist } from "zustand/middleware";

// Dark mode removed — always light
document.documentElement.classList.remove("dark");
try { localStorage.setItem("trakvora-theme", "light"); } catch { /* noop */ }

export const useUIStore = create(
  persist(
    (set) => ({
      sidebarOpen: true,
      modalStack: [],
      theme: "light",
      guestCountry: "KE",

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebar: (open) => set({ sidebarOpen: open }),

      openModal: (id) => set((s) => ({ modalStack: [...s.modalStack, id] })),
      closeModal: () => set((s) => ({ modalStack: s.modalStack.slice(0, -1) })),
      isModalOpen: (id) => (state) => state.modalStack.includes(id),

      toggleTheme: () => { /* dark mode disabled */ },
      setGuestCountry: (code) => set({ guestCountry: code }),
    }),
    {
      name: "trakvora-ui",
      partialize: (state) => ({ guestCountry: state.guestCountry }),
      onRehydrateStorage: () => (state) => {
        const OPERATING = new Set(["KE", "UG", "TZ"]);
        if (state && !OPERATING.has(state.guestCountry)) {
          state.guestCountry = "KE";
        }
      },
    }
  )
);
