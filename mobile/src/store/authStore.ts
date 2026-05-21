import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as SecureStore from "expo-secure-store";

const secureStorage = {
  getItem: async (name: string) => {
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string) => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string) => {
    await SecureStore.deleteItemAsync(name);
  },
};

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: "shipper" | "owner" | "driver" | "admin";
  admin_role?: string;
  country?: string;
  is_verified?: boolean;
  kyc_status?: string;
  profile_photo_url?: string;
  expo_push_token?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  loginAt: number | null;
  rememberMe: boolean;

  setAuth: (user: User, accessToken: string, refreshToken: string, rememberMe?: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      loginAt: null,
      rememberMe: false,

      setAuth: (user, accessToken, refreshToken, rememberMe = false) =>
        set({ user, accessToken, refreshToken, rememberMe, loginAt: Date.now() }),

      updateUser: (updates) =>
        set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),

      clearAuth: () =>
        set({ user: null, accessToken: null, refreshToken: null, loginAt: null, rememberMe: false }),
    }),
    {
      name: "trakvora-auth",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        loginAt: state.loginAt,
        rememberMe: state.rememberMe,
      }),
    }
  )
);
