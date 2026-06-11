import { describe, it, expect, beforeEach } from "vitest";
import { useUIStore } from "./uiStore";

// Reset store state between tests
beforeEach(() => {
  useUIStore.setState({
    sidebarOpen: true,
    modalStack: [],
    theme: "light",
  });
});

describe("uiStore — sidebar", () => {
  it("starts with sidebarOpen = true", () => {
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("toggleSidebar flips sidebarOpen to false", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("toggleSidebar flips back to true on second call", () => {
    useUIStore.getState().toggleSidebar();
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });

  it("setSidebar(false) sets sidebarOpen to false", () => {
    useUIStore.getState().setSidebar(false);
    expect(useUIStore.getState().sidebarOpen).toBe(false);
  });

  it("setSidebar(true) sets sidebarOpen to true when already false", () => {
    useUIStore.setState({ sidebarOpen: false });
    useUIStore.getState().setSidebar(true);
    expect(useUIStore.getState().sidebarOpen).toBe(true);
  });
});

describe("uiStore — theme", () => {
  it("starts with light theme", () => {
    expect(useUIStore.getState().theme).toBe("light");
  });

  it("toggleTheme is a no-op (dark mode disabled)", () => {
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("light");
  });

  it("theme stays light after toggleTheme when starting dark", () => {
    useUIStore.setState({ theme: "dark" });
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("dark");
  });
});

describe("uiStore — modal stack", () => {
  it("starts with empty modal stack", () => {
    expect(useUIStore.getState().modalStack).toHaveLength(0);
  });

  it("openModal adds id to stack", () => {
    useUIStore.getState().openModal("confirm-dialog");
    expect(useUIStore.getState().modalStack).toContain("confirm-dialog");
  });

  it("isModalOpen returns true after openModal", () => {
    useUIStore.getState().openModal("confirm-dialog");
    const selector = useUIStore.getState().isModalOpen("confirm-dialog");
    expect(selector(useUIStore.getState())).toBe(true);
  });

  it("isModalOpen returns false for a modal not in stack", () => {
    const selector = useUIStore.getState().isModalOpen("other-modal");
    expect(selector(useUIStore.getState())).toBe(false);
  });

  it("closeModal removes the last modal from stack", () => {
    useUIStore.getState().openModal("first");
    useUIStore.getState().openModal("second");
    useUIStore.getState().closeModal();
    expect(useUIStore.getState().modalStack).not.toContain("second");
    expect(useUIStore.getState().modalStack).toContain("first");
  });

  it("closeModal on empty stack does not error", () => {
    expect(() => useUIStore.getState().closeModal()).not.toThrow();
  });
});
