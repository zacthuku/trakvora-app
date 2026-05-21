import { create } from "zustand";
import { notificationsApi } from "../api/notifications";
import { useAuthStore } from "./authStore";

interface Notification {
  id: number | string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  time: string;
  reference_id?: number;
  reference_type?: string;
}

interface NotificationState {
  notifications: Notification[];
  isLoading: boolean;
  fetchNotifications: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: number | string) => void;
  clearAll: () => void;
  addNotification: (notif: Partial<Notification>) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  isLoading: false,

  fetchNotifications: async () => {
    if (!useAuthStore.getState().accessToken) return;
    set({ isLoading: true });
    try {
      const data = await notificationsApi.getNotifications();
      set({
        notifications: data.map((n: any) => ({
          id: n.id,
          type: n.notification_type,
          title: n.title,
          body: n.body,
          read: n.is_read,
          time: n.created_at,
          reference_id: n.reference_id,
          reference_type: n.reference_type,
        })),
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  markRead: async (id) => {
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
    try {
      await notificationsApi.markRead(id);
    } catch {
      // optimistic
    }
  },

  markAllRead: async () => {
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
    try {
      await notificationsApi.markAllRead();
    } catch {
      // optimistic
    }
  },

  dismiss: (id) =>
    set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

  clearAll: () => set({ notifications: [] }),

  addNotification: (notif) =>
    set((s) => ({
      notifications: [
        {
          id: `n-${Date.now()}`,
          type: "info",
          title: "",
          body: "",
          read: false,
          time: new Date().toISOString(),
          ...notif,
        },
        ...s.notifications,
      ].slice(0, 50),
    })),
}));
