import apiClient from "@/services/apiClient";

export const companiesApi = {
  createCompany: (data) =>
    apiClient.post("/companies", data).then((r) => r.data),

  listMyCompanies: () =>
    apiClient.get("/companies").then((r) => r.data),

  getCompany: (id) =>
    apiClient.get(`/companies/${id}`).then((r) => r.data),

  listMembers: (id) =>
    apiClient.get(`/companies/${id}/members`).then((r) => r.data),

  inviteMember: (id, data) =>
    apiClient.post(`/companies/${id}/members`, data).then((r) => r.data),

  removeMember: (companyId, userId) =>
    apiClient.delete(`/companies/${companyId}/members/${userId}`).then((r) => r.data),

  getAnalytics: (id, params) =>
    apiClient.get(`/companies/${id}/analytics`, { params }).then((r) => r.data),

  // Preferred Carrier Network
  listPreferredCarriers: (id) =>
    apiClient.get(`/companies/${id}/preferred-carriers`).then((r) => r.data),
  addPreferredCarrier: (id, carrier_user_id) =>
    apiClient.post(`/companies/${id}/preferred-carriers`, { carrier_user_id }).then((r) => r.data),
  removePreferredCarrier: (id, carrier_user_id) =>
    apiClient.delete(`/companies/${id}/preferred-carriers/${carrier_user_id}`).then((r) => r.data),

  // Search carriers by phone/name
  searchCarriers: (q) =>
    apiClient.get("/users/search-carriers", { params: { q } }).then((r) => r.data),
};
