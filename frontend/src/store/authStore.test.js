import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore } from "./authStore";

const MOCK_USER = { id: "uuid-123", email: "test@trakvora.com", role: "shipper", full_name: "Test User" };

// Reset store state between tests
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    loginAt: null,
    rememberMe: false,
  });
});

describe("authStore — initial state", () => {
  it("starts with null user", () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("starts with null accessToken", () => {
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});

describe("authStore — setAuth", () => {
  it("sets user, tokens, and loginAt", () => {
    useAuthStore.getState().setAuth(MOCK_USER, "access-token", "refresh-token");
    const state = useAuthStore.getState();
    expect(state.user).toEqual(MOCK_USER);
    expect(state.accessToken).toBe("access-token");
    expect(state.refreshToken).toBe("refresh-token");
    expect(state.loginAt).toBeGreaterThan(0);
  });

  it("sets rememberMe when provided", () => {
    useAuthStore.getState().setAuth(MOCK_USER, "at", "rt", true);
    expect(useAuthStore.getState().rememberMe).toBe(true);
  });

  it("rememberMe defaults to false", () => {
    useAuthStore.getState().setAuth(MOCK_USER, "at", "rt");
    expect(useAuthStore.getState().rememberMe).toBe(false);
  });
});

describe("authStore — updateUser", () => {
  it("merges partial updates into existing user", () => {
    useAuthStore.getState().setAuth(MOCK_USER, "at", "rt");
    useAuthStore.getState().updateUser({ full_name: "Updated Name" });
    const user = useAuthStore.getState().user;
    expect(user.full_name).toBe("Updated Name");
    expect(user.email).toBe("test@trakvora.com");
  });

  it("does nothing when user is null", () => {
    useAuthStore.getState().updateUser({ full_name: "Nobody" });
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("authStore — clearAuth", () => {
  it("resets all fields to null/false", () => {
    useAuthStore.getState().setAuth(MOCK_USER, "at", "rt", true);
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.loginAt).toBeNull();
    expect(state.rememberMe).toBe(false);
  });
});
