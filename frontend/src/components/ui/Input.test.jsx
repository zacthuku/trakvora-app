import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Input from "./Input";

describe("Input", () => {
  it("renders an input element", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("renders label text when label prop is provided", () => {
    render(<Input label="Email address" />);
    expect(screen.getByText("Email address")).toBeInTheDocument();
  });

  it("does not render label element when label prop is absent", () => {
    render(<Input />);
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
  });

  it("renders placeholder text", () => {
    render(<Input placeholder="Enter email" />);
    expect(screen.getByPlaceholderText("Enter email")).toBeInTheDocument();
  });

  it("shows error message when error prop is provided", () => {
    render(<Input error="Field is required" />);
    expect(screen.getByText("Field is required")).toBeInTheDocument();
  });

  it("applies red border class when error is present", () => {
    render(<Input error="Invalid" />);
    expect(screen.getByRole("textbox")).toHaveClass("border-red-500");
  });

  it("does not apply red border when no error", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).not.toHaveClass("border-red-500");
  });

  it("fires onChange with new value", () => {
    const onChange = vi.fn();
    render(<Input onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "hello" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("passes type prop to the input", () => {
    const { container } = render(<Input type="password" />);
    expect(container.querySelector("input")).toHaveAttribute("type", "password");
  });
});
