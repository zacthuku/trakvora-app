import { create } from "zustand";
import { subscriptionsApi } from "@/features/subscriptions/api/subscriptionsApi";

export const useSubscriptionStore = create((set, get) => ({
  subscription: null,
  plans: [],
  isLoading: false,

  fetchSubscription: async () => {
    set({ isLoading: true });
    try {
      const subscription = await subscriptionsApi.getMySubscription();
      set({ subscription, isLoading: false });
    } catch {
      set({ subscription: null, isLoading: false });
    }
  },

  fetchPlans: async () => {
    const plans = await subscriptionsApi.listPlans();
    set({ plans });
    return plans;
  },

  subscribe: async (planId) => {
    const subscription = await subscriptionsApi.subscribe(planId);
    set({ subscription });
    return subscription;
  },

  cancel: async () => {
    const subscription = await subscriptionsApi.cancel();
    set({ subscription });
    return subscription;
  },

  clear: () => set({ subscription: null }),
}));
