import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock the constants dependency
vi.mock("@/utils/constants", () => ({
  LOAD_STATUS_LABELS: {
    available: "Available",
    in_transit: "In Transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
  },
  LOAD_STATUS_COLORS: {
    available: "bg-teal-50 text-teal-700",
    in_transit: "bg-blue-50 text-blue-700",
    delivered: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
  },
}));

import { Badge, StatusBadge } from "./Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("applies default slate color classes", () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText("Default")).toHaveClass("bg-slate-100", "text-slate-700");
  });

  it("applies orange color classes", () => {
    render(<Badge color="orange">Pending</Badge>);
    expect(screen.getByText("Pending")).toHaveClass("bg-orange-100", "text-orange-700");
  });

  it("applies red color classes", () => {
    render(<Badge color="red">Error</Badge>);
    expect(screen.getByText("Error")).toHaveClass("bg-red-100", "text-red-700");
  });

  it("applies green color classes", () => {
    render(<Badge color="green">Done</Badge>);
    expect(screen.getByText("Done")).toHaveClass("bg-green-100", "text-green-700");
  });

  it("merges extra className", () => {
    render(<Badge className="custom-class">Tag</Badge>);
    expect(screen.getByText("Tag")).toHaveClass("custom-class");
  });
});

describe("StatusBadge", () => {
  it("renders the label for a known status", () => {
    render(<StatusBadge status="available" />);
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("renders the label for in_transit status", () => {
    render(<StatusBadge status="in_transit" />);
    expect(screen.getByText("In Transit")).toBeInTheDocument();
  });

  it("renders raw status string for unknown status", () => {
    render(<StatusBadge status="unknown_status" />);
    expect(screen.getByText("unknown_status")).toBeInTheDocument();
  });

  it("applies color class for known status", () => {
    render(<StatusBadge status="available" />);
    expect(screen.getByText("Available")).toHaveClass("bg-teal-50", "text-teal-700");
  });
});
