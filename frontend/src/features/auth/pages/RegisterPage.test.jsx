/* global global */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/auth/api/authApi", () => ({
  authApi: { register: vi.fn() },
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

vi.mock("@/components/ui/PhoneCountryInput", () => ({
  default: ({ onChange }) => (
    <input
      data-testid="phone-input"
      placeholder="Phone number"
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

vi.mock("@/features/auth/components/GoogleAuthButton", () => ({
  default: () => null,
}));

vi.mock("@/features/auth/components/OtpModal", () => ({
  default: ({ onSuccess }) => (
    <div data-testid="otp-modal">
      <button onClick={() => onSuccess?.({ access_token: "tok", refresh_token: "rtok" })}>
        Verify OTP
      </button>
    </div>
  ),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

import RegisterPage from "./RegisterPage";
import { authApi } from "@/features/auth/api/authApi";

const renderRegisterPage = () =>
  render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe("RegisterPage", () => {
  it("renders full name, email, and password fields", () => {
    renderRegisterPage();
    expect(screen.getByPlaceholderText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("you@example.com")).toBeInTheDocument();
  });

  it("renders role selection options", () => {
    renderRegisterPage();
    // Role options: Shipper, Fleet Owner, Driver
    expect(screen.getByText("Shipper")).toBeInTheDocument();
    expect(screen.getByText("Fleet Owner")).toBeInTheDocument();
    expect(screen.getByText("Driver")).toBeInTheDocument();
  });

  it("shows password mismatch error when passwords do not match", async () => {
    renderRegisterPage();

    const passwords = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(passwords[0], { target: { value: "StrongPass1!" } });
    fireEvent.change(passwords[1], { target: { value: "DifferentPass1!" } });

    // Error renders inline as soon as passwords differ — no submit needed
    await waitFor(() =>
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument()
    );
  });

  it("shows error message on API failure", async () => {
    authApi.register.mockRejectedValue({
      response: { data: { detail: "Email already registered" } },
    });

    renderRegisterPage();
    fireEvent.change(screen.getByPlaceholderText("Jane Doe"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "test@test.com" },
    });

    const passwords = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(passwords[0], { target: { value: "StrongPass1!" } });
    fireEvent.change(passwords[1], { target: { value: "StrongPass1!" } });

    // Terms checkbox must be checked or the submit button is disabled
    const termsCheckbox = screen.getByRole("checkbox");
    fireEvent.click(termsCheckbox);

    const submitBtn = screen.getByRole("button", { name: /initialize account/i });
    fireEvent.click(submitBtn);

    await waitFor(() =>
      expect(screen.getByText(/email already registered/i)).toBeInTheDocument()
    );
  });

  it("calls authApi.register when form is valid and submitted", async () => {
    authApi.register.mockResolvedValue({
      requires_verification: true,
      email: "new@test.com",
      channel: "sms",
      destination: "+254*****001",
    });
    global.fetch.mockResolvedValue({
      json: () => Promise.resolve({ id: "1", role: "shipper", email: "new@test.com" }),
    });

    renderRegisterPage();
    fireEvent.change(screen.getByPlaceholderText("Jane Doe"), {
      target: { value: "New User" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "new@test.com" },
    });

    const passwords = screen.getAllByPlaceholderText("••••••••");
    fireEvent.change(passwords[0], { target: { value: "StrongPass1!" } });
    fireEvent.change(passwords[1], { target: { value: "StrongPass1!" } });

    // Terms checkbox must be checked or the submit button is disabled
    const termsCheckbox = screen.getByRole("checkbox");
    fireEvent.click(termsCheckbox);

    const submitBtn = screen.getByRole("button", { name: /initialize account/i });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(authApi.register).toHaveBeenCalled());
  });
});
