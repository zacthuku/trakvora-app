import { create } from "zustand";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "trakvora-theme";

interface UIState {
  theme: "light" | "dark";
  modalStack: string[];
  toggleTheme: () => Promise<void>;
  setTheme: (t: "light" | "dark") => void;
  openModal: (id: string) => void;
  closeModal: () => void;
  isModalOpen: (id: string) => boolean;
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: (Appearance.getColorScheme() as "light" | "dark") ?? "light",
  modalStack: [],

  toggleTheme: async () => {
    const next = get().theme === "dark" ? "light" : "dark";
    set({ theme: next });
    try {
      await AsyncStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
  },

  setTheme: (t) => set({ theme: t }),

  openModal: (id) =>
    set((s) => ({ modalStack: [...s.modalStack, id] })),

  closeModal: () =>
    set((s) => ({ modalStack: s.modalStack.slice(0, -1) })),

  isModalOpen: (id) => get().modalStack.includes(id),
}));
