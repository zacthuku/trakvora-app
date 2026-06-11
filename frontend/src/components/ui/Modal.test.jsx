import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
  it("renders nothing when open is false", () => {
    render(<Modal open={false} onClose={vi.fn()} title="Test"><p>content</p></Modal>);
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("renders content when open is true", () => {
    render(<Modal open={true} onClose={vi.fn()} title="My Modal"><p>modal body</p></Modal>);
    expect(screen.getByText("modal body")).toBeInTheDocument();
  });

  it("renders the title", () => {
    render(<Modal open={true} onClose={vi.fn()} title="Confirm Action"><p>x</p></Modal>);
    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    render(<Modal open={true} onClose={onClose} title="Title"><p>x</p></Modal>);
    // The X button is the one containing the SVG icon — find by its sibling title
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<Modal open={true} onClose={onClose} title="Title"><p>x</p></Modal>);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose} title="Title"><p>x</p></Modal>
    );
    // Backdrop is a fixed inset-0 div with bg-black/50
    const backdrop = container.querySelector(".bg-black\\/50");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders children inside the modal", () => {
    render(
      <Modal open={true} onClose={vi.fn()} title="T">
        <button>Action button</button>
      </Modal>
    );
    expect(screen.getByRole("button", { name: /action button/i })).toBeInTheDocument();
  });
});
