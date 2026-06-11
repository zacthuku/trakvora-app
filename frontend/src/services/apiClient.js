import axios from "axios";
import { useAuthStore } from "@/store/authStore";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
  pendingQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
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
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return apiClient(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) throw new Error("No refresh token");

      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL || "http://localhost:8000"}/auth/refresh`,
        { refresh_token: refreshToken }
      );
      const { user, rememberMe } = useAuthStore.getState();
      useAuthStore.getState().setAuth(user, data.access_token, data.refresh_token, rememberMe);
      processQueue(null, data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return apiClient(original);
    } catch (err) {
      processQueue(err, null);
      // Only force-logout when the refresh endpoint explicitly rejects (4xx).
      // Network errors or 5xx server faults should not clear valid credentials.
      const status = err.response?.status;
      if (status && status >= 400 && status < 500) {
        useAuthStore.getState().clearAuth();
        const publicPaths = ["/", "/login", "/register", "/pricing", "/help", "/terms",
          "/privacy", "/for-shippers", "/for-fleet-owners", "/for-drivers", "/jobs", "/trucks"];
        const isPublic = publicPaths.some((p) => window.location.pathname === p);
        if (!isPublic) window.location.href = "/login";
      }
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
    }
  }
);

export default apiClient;
