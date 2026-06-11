import { create } from "zustand";
import { persist } from "zustand/middleware";
import { companiesApi } from "@/features/companies/api/companiesApi";

export const useCompanyStore = create(
  persist(
    (set, get) => ({
      companies: [],
      activeCompanyId: null,
      members: [],
      isLoading: false,

      activeCompany: () =>
        get().companies.find((c) => c.id === get().activeCompanyId) ?? null,

      setActiveCompany: (id) => set({ activeCompanyId: id }),

      fetchCompanies: async () => {
        set({ isLoading: true });
        try {
          const companies = await companiesApi.listMyCompanies();
          set({ companies, isLoading: false });
          // Auto-select first company if none selected
          if (!get().activeCompanyId && companies.length > 0) {
            set({ activeCompanyId: companies[0].id });
          }
        } catch {
          set({ isLoading: false });
        }
      },

      fetchMembers: async (companyId) => {
        const members = await companiesApi.listMembers(companyId);
        set({ members });
        return members;
      },

      createCompany: async (data) => {
        const company = await companiesApi.createCompany(data);
        set((s) => ({ companies: [...s.companies, company], activeCompanyId: company.id }));
        return company;
      },

      clear: () => set({ companies: [], activeCompanyId: null, members: [] }),
    }),
    { name: "company-store", partialize: (s) => ({ activeCompanyId: s.activeCompanyId }) }
  )
);
