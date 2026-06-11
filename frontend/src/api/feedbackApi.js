import apiClient from "@/services/apiClient";

export const feedbackApi = {
  submit:           (data) => apiClient.post("/feedback", data).then(r => r.data),
  listTestimonials: ()     => apiClient.get("/testimonials").then(r => r.data),
};
