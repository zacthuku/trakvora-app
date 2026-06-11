import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Spinner, { PageSpinner } from "./Spinner";

describe("Spinner", () => {
  it("renders with md size by default", () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toHaveClass("w-8", "h-8");
  });

  it("renders with sm size", () => {
    const { container } = render(<Spinner size="sm" />);
    expect(container.firstChild).toHaveClass("w-4", "h-4");
  });

  it("renders with lg size", () => {
    const { container } = render(<Spinner size="lg" />);
    expect(container.firstChild).toHaveClass("w-12", "h-12");
  });

  it("applies animate-spin class", () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toHaveClass("animate-spin");
  });

  it("merges extra className", () => {
    const { container } = render(<Spinner className="my-extra" />);
    expect(container.firstChild).toHaveClass("my-extra");
  });
});

describe("PageSpinner", () => {
  it("renders a centered spinner", () => {
    const { container } = render(<PageSpinner />);
    expect(container.firstChild).toHaveClass("flex", "items-center", "justify-center");
  });
});
