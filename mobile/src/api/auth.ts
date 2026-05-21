import apiClient from "./client";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: "shipper" | "owner" | "driver";
  country?: string;
}

export interface OtpPayload {
  email: string;
  otp_code: string;
}

export const authApi = {
  login: (data: LoginPayload) =>
    apiClient.post("/auth/login", data).then((r) => r.data),

  register: (data: RegisterPayload) =>
    apiClient.post("/auth/register", data).then((r) => r.data),

  sendOtp: (email: string, channel: "email" | "sms" = "email") =>
    apiClient.post("/auth/send-otp", { email, channel }).then((r) => r.data),

  verifyOtp: (data: OtpPayload) =>
    apiClient.post("/auth/verify-otp", data).then((r) => r.data),

  refresh: (refresh_token: string) =>
    apiClient.post("/auth/refresh", { refresh_token }).then((r) => r.data),

  logout: () => apiClient.post("/auth/logout").then((r) => r.data),
};
