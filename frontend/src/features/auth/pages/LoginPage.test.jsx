/* global global */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/api/authApi", () => ({
  authApi: { login: vi.fn() },
}));

vi.mock("@/store/authStore", () => ({
  useAuthStore: vi.fn((selector) =>
    selector({ setAuth: vi.fn(), user: null, accessToken: null })
  ),
}));

vi.mock("@/components/ui/Logo", () => ({
  LogoFull: () => <div data-testid="logo" />,
}));

vi.mock("@/components/ui/SocialButtons", () => ({
  SocialButton: () => null,
  AppleIcon: () => null,
}));

vi.mock("@/features/auth/components/GoogleAuthButton", () => ({
  default: () => null,
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import LoginPage from "./LoginPage";
import { authApi } from "@/features/auth/api/authApi";

const renderLoginPage = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("LoginPage", () => {
  it("renders email and password fields", () => {
    renderLoginPage();
    expect(screen.getByPlaceholderText("name@company.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("••••••••")).toBeInTheDocument();
  });

  it("renders a sign in submit button", () => {
    renderLoginPage();
    expect(
      screen.getByRole("button", { name: /sign in|log in/i })
    ).toBeInTheDocument();
  });

  it("shows error message on invalid credentials", async () => {
    authApi.login.mockRejectedValue({
      response: { data: { detail: "Invalid credentials" } },
    });

    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText("name@company.com"), {
      target: { value: "bad@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in|log in/i }));

    await waitFor(() =>
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument()
    );
  });

  it("calls authApi.login with email and password on submit", async () => {
    authApi.login.mockResolvedValue({ access_token: "tok", refresh_token: "rtok" });
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ id: "1", role: "shipper", email: "user@test.com" }),
    });

    renderLoginPage();
    fireEvent.change(screen.getByPlaceholderText("name@company.com"), {
      target: { value: "user@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), {
      target: { value: "MyPass1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in|log in/i }));

    await waitFor(() => expect(authApi.login).toHaveBeenCalled());
    expect(authApi.login).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@test.com", password: "MyPass1!" })
    );
  });
});
