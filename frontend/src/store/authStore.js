import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      loginAt: null,
      rememberMe: false,
      fcmToken: null,

      setAuth: (user, accessToken, refreshToken, rememberMe = false) =>
        set({ user, accessToken, refreshToken, rememberMe, loginAt: Date.now() }),

      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, loginAt: null, rememberMe: false, fcmToken: null }),

      setFcmToken: (fcmToken) => set({ fcmToken }),
    }),
    {
      name: "trakvora-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        loginAt: state.loginAt,
        rememberMe: state.rememberMe,
        fcmToken: state.fcmToken,
      }),
    }
  )
);
