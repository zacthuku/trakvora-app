import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import PasswordStrength, { isPasswordStrong } from "./PasswordStrength";

describe("PasswordStrength component", () => {
  it("renders nothing when password is empty", () => {
    const { container } = render(<PasswordStrength password="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when password prop is absent", () => {
    const { container } = render(<PasswordStrength />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows all 5 rule labels", () => {
    render(<PasswordStrength password="a" />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("One uppercase letter")).toBeInTheDocument();
    expect(screen.getByText("One lowercase letter")).toBeInTheDocument();
    expect(screen.getByText("One digit")).toBeInTheDocument();
    expect(screen.getByText("One special character")).toBeInTheDocument();
  });

  it("shows 'At least 8 characters' rule as met for 8+ char input", () => {
    render(<PasswordStrength password="abcdefgh" />);
    // The rule list item turns green (text-green-600) when met
    const ruleItem = screen.getByText("At least 8 characters").closest("li");
    expect(ruleItem).toHaveClass("text-green-600");
  });

  it("shows uppercase rule as met when input has uppercase", () => {
    render(<PasswordStrength password="A" />);
    const ruleItem = screen.getByText("One uppercase letter").closest("li");
    expect(ruleItem).toHaveClass("text-green-600");
  });

  it("shows uppercase rule as not met when input has no uppercase", () => {
    render(<PasswordStrength password="abc" />);
    const ruleItem = screen.getByText("One uppercase letter").closest("li");
    expect(ruleItem).toHaveClass("text-slate-400");
  });

  it("shows 'Weak' label for a single character", () => {
    render(<PasswordStrength password="a" />);
    expect(screen.getByText("Weak")).toBeInTheDocument();
  });

  it("shows 'Strong' label for a fully valid password", () => {
    render(<PasswordStrength password="StrongPass1!" />);
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });
});

describe("isPasswordStrong", () => {
  it("returns false for a weak password", () => {
    expect(isPasswordStrong("weak")).toBe(false);
  });

  it("returns false when missing a special character", () => {
    expect(isPasswordStrong("StrongPass1")).toBe(false);
  });

  it("returns true for a fully valid password", () => {
    expect(isPasswordStrong("StrongPass1!")).toBe(true);
  });

  it("returns false for a password missing a digit", () => {
    expect(isPasswordStrong("StrongPass!")).toBe(false);
  });
});
