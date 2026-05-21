import apiClient from "./client";

export const usersApi = {
  getMe: () => apiClient.get("/users/me").then((r) => r.data),
  updateMe: (data: any) => apiClient.patch("/users/me", data).then((r) => r.data),
  uploadProfilePhoto: (uri: string, fileName: string) => {
    const form = new FormData();
    form.append("file", { uri, name: fileName, type: "image/jpeg" } as any);
    return apiClient
      .post("/uploads/photo", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  submitKYC: (data: any) => apiClient.post("/users/me/kyc", data).then((r) => r.data),
};
