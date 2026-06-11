import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/store/uiStore", () => ({
  useUIStore: vi.fn((selector) => selector({ theme: "light" })),
}));

import { LogoIcon, LogoFull, LogoWordmark } from "./Logo";

describe("LogoIcon", () => {
  it("renders an img element", () => {
    render(<LogoIcon />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("uses default size 52", () => {
    render(<LogoIcon />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "42");
    expect(img).toHaveAttribute("height", "42");
  });

  it("accepts a custom size", () => {
    render(<LogoIcon size={80} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("width", "64");
    expect(img).toHaveAttribute("height", "64");
  });
});

describe("LogoFull", () => {
  it("renders TRAK and VORA text", () => {
    render(<LogoFull />);
    expect(screen.getByText("TRAK")).toBeInTheDocument();
    expect(screen.getByText("VORA")).toBeInTheDocument();
  });

  it("VORA always uses the orange color", () => {
    render(<LogoFull />);
    expect(screen.getByText("VORA")).toHaveStyle({ color: "#fe6a34" });
  });

  it("variant=dark makes TRAK white", () => {
    render(<LogoFull variant="dark" />);
    expect(screen.getByText("TRAK")).toHaveStyle({ color: "rgb(255, 255, 255)" });
  });

  it("variant=light makes TRAK navy", () => {
    render(<LogoFull variant="light" />);
    expect(screen.getByText("TRAK")).toHaveStyle({ color: "#041627" });
  });

  it("variant=auto + light theme makes TRAK navy", () => {
    // useUIStore is already mocked to return theme: 'light'
    render(<LogoFull variant="auto" />);
    expect(screen.getByText("TRAK")).toHaveStyle({ color: "#041627" });
  });

  it("variant=auto + dark theme makes TRAK white", async () => {
    const { useUIStore } = await import("@/store/uiStore");
    useUIStore.mockImplementation((selector) => selector({ theme: "dark" }));
    render(<LogoFull variant="auto" />);
    expect(screen.getByText("TRAK")).toHaveStyle({ color: "rgb(255, 255, 255)" });
    // Restore
    useUIStore.mockImplementation((selector) => selector({ theme: "light" }));
  });

  it("renders tagline when tagline prop is provided", () => {
    render(<LogoFull tagline="Freight Network" />);
    expect(screen.getByText("Freight Network")).toBeInTheDocument();
  });

  it("does not render tagline element when tagline prop is absent", () => {
    render(<LogoFull />);
    expect(screen.queryByText("Freight Network")).not.toBeInTheDocument();
  });

  it("merges extra className onto wrapper div", () => {
    const { container } = render(<LogoFull className="my-logo-class" />);
    expect(container.firstChild).toHaveClass("my-logo-class");
  });
});

describe("LogoWordmark", () => {
  it("renders TRAK and VORA", () => {
    render(<LogoWordmark />);
    expect(screen.getByText("TRAK")).toBeInTheDocument();
    expect(screen.getByText("VORA")).toBeInTheDocument();
  });

  it("default size maps to text-2xl", () => {
    const { container } = render(<LogoWordmark />);
    expect(container.firstChild).toHaveClass("text-2xl");
  });

  it("size=lg maps to text-lg", () => {
    const { container } = render(<LogoWordmark size="lg" />);
    expect(container.firstChild).toHaveClass("text-lg");
  });

  it("size=xl maps to text-xl", () => {
    const { container } = render(<LogoWordmark size="xl" />);
    expect(container.firstChild).toHaveClass("text-xl");
  });

  it("unknown size falls back to text-2xl", () => {
    const { container } = render(<LogoWordmark size="unknown" />);
    expect(container.firstChild).toHaveClass("text-2xl");
  });
});
