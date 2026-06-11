import { create } from "zustand";
import { inboxApi } from "@/api/inboxApi";
import { useAuthStore } from "@/store/authStore";

export const useInboxStore = create((set) => ({
  messages: [],
  unreadCount: 0,
  isLoading: false,

  fetchMessages: async () => {
    if (!useAuthStore.getState().accessToken) return;
    set({ isLoading: true });
    try {
      const data = await inboxApi.list();
      set({
        messages: data,
        unreadCount: data.filter(m => !m.is_read).length,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  fetchUnreadCount: async () => {
    if (!useAuthStore.getState().accessToken) return;
    try {
      const { count } = await inboxApi.unreadCount();
      set({ unreadCount: count });
    } catch { /* silent */ }
  },

  markRead: async (id) => {
    set(s => ({
      messages:    s.messages.map(m => m.id === id ? { ...m, is_read: true } : m),
      unreadCount: Math.max(0, s.unreadCount - 1),
    }));
    try { await inboxApi.markRead(id); } catch { /* optimistic */ }
  },

  markAllRead: async () => {
    set(s => ({
      messages:    s.messages.map(m => ({ ...m, is_read: true })),
      unreadCount: 0,
    }));
    try { await inboxApi.markAllRead(); } catch { /* optimistic */ }
  },
}));
