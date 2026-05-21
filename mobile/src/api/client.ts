import axios from "axios";
import Constants from "expo-constants";
import { EventEmitter } from "eventemitter3";

const BASE_URL =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:8000";

export const authEvents = new EventEmitter();

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Lazy import to avoid circular dependency
let getAuthState: () => { accessToken: string | null; refreshToken: string | null };
let setAuth: (user: any, access: string, refresh: string, remember: boolean) => void;
let clearAuth: () => void;

export function injectAuthStore(store: {
  getState: () => {
    accessToken: string | null;
    refreshToken: string | null;
    user: any;
    rememberMe: boolean;
    setAuth: (user: any, access: string, refresh: string, remember: boolean) => void;
    clearAuth: () => void;
  };
}) {
  getAuthState = () => store.getState();
  setAuth = (u, a, r, m) => store.getState().setAuth(u, a, r, m);
  clearAuth = () => store.getState().clearAuth();
}

apiClient.interceptors.request.use((config) => {
  const token = getAuthState?.()?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let pendingQueue: { resolve: (t: string) => void; reject: (e: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  pendingQueue = [];
};

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const state = getAuthState?.();
      const refreshToken = state?.refreshToken;
      if (!refreshToken) throw new Error("No refresh token");

      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const currentState = getAuthState() as any;
      setAuth(currentState.user, data.access_token, data.refresh_token, currentState.rememberMe);
      processQueue(null, data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return apiClient(original);
    } catch (err) {
      processQueue(err, null);
      clearAuth?.();
      authEvents.emit("unauthorized");
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
