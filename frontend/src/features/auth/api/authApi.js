import apiClient from "@/services/apiClient";

export const invitationsApi = {
  validate: (token) => apiClient.get(`/invitations/validate/${token}`).then((r) => r.data),
  create: (data) => apiClient.post("/invitations", data).then((r) => r.data),
  listPending: (companyId) =>
    apiClient
      .get("/invitations/pending", { params: companyId ? { company_id: companyId } : {} })
      .then((r) => r.data),
  cancel: (id) => apiClient.patch(`/invitations/${id}/cancel`),
};

export const authApi = {
  register: (data) => apiClient.post("/auth/register", data).then((r) => r.data),
  login: (data) => apiClient.post("/auth/login", data).then((r) => r.data),
  sendOtp: (email, channel) =>
    apiClient.post("/auth/send-otp", { email, channel }).then((r) => r.data),
  sendPhoneOtp: (phone) =>
    apiClient.post("/auth/phone-login", { phone }).then((r) => r.data),
  verifyOtp: (data) => apiClient.post("/auth/verify-otp", data).then((r) => r.data),
  resendOtp: (email) => apiClient.post("/auth/resend-otp", { email }),
  refresh: (refreshToken) =>
    apiClient.post("/auth/refresh", { refresh_token: refreshToken }).then((r) => r.data),
  me: () => apiClient.get("/users/me").then((r) => r.data),
  googleAuth: (accessToken, role = null, termsAccepted = false) =>
    apiClient.post("/auth/google", { access_token: accessToken, role, terms_accepted: termsAccepted }).then((r) => r.data),
  forgotPassword: (email) => apiClient.post("/auth/forgot-password", { email }),
  forgotPasswordPhone: (phone) => apiClient.post("/auth/forgot-password-phone", { phone }),
  verifyResetOtp: (email, code) =>
    apiClient.post("/auth/verify-reset-otp", { email, code }).then((r) => r.data),
  verifyResetOtpPhone: (phone, code) =>
    apiClient.post("/auth/verify-reset-otp-phone", { phone, code }).then((r) => r.data),
  resetPassword: (resetToken, newPassword) =>
    apiClient.post("/auth/reset-password", { reset_token: resetToken, new_password: newPassword }),
  changePassword: (currentPassword, newPassword) =>
    apiClient.post("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    }),
  changeRole: (role) => apiClient.patch("/users/me/role", { role }).then((r) => r.data),
};
