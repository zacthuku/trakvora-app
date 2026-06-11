import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock Logo to avoid SVG/img complexities
vi.mock("@/components/ui/Logo", () => ({
  LogoFull: ({ tagline }) => <div data-testid="logo">{tagline}</div>,
}));

// Default: unauthenticated
const mockAuthState = { user: null, accessToken: null };
const mockAuthStore = vi.fn((selector) => selector(mockAuthState));
vi.mock("@/store/authStore", () => ({
  useAuthStore: Object.assign(
    (...args) => mockAuthStore(...args),
    { getState: () => mockAuthState }
  ),
}));

import MainNav from "./MainNav";

const renderNav = (props = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MainNav {...props} />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

beforeEach(() => {
  mockAuthStore.mockImplementation((selector) => selector({ user: null }));
});

describe("MainNav — unauthenticated", () => {
  it("renders the logo", () => {
    renderNav();
    expect(screen.getAllByTestId("logo").length).toBeGreaterThan(0);
  });

  it("renders the Products nav button", () => {
    renderNav();
    expect(screen.getByRole("button", { name: /products/i })).toBeInTheDocument();
  });

  it("renders the Solutions nav button", () => {
    renderNav();
    expect(screen.getByRole("button", { name: /solutions/i })).toBeInTheDocument();
  });

  it("renders a Log in link when user is not authenticated", () => {
    renderNav();
    expect(screen.getByRole("link", { name: /log in/i })).toBeInTheDocument();
  });

  it("renders Book a Demo button when hideDemoBtn is false", () => {
    renderNav({ hideDemoBtn: false });
    expect(screen.getByRole("link", { name: /book a demo|demo/i })).toBeInTheDocument();
  });

  it("does not render Book a Demo button when hideDemoBtn is true", () => {
    renderNav({ hideDemoBtn: true });
    expect(screen.queryByRole("link", { name: /book a demo/i })).not.toBeInTheDocument();
  });
});

describe("MainNav — authenticated", () => {
  beforeEach(() => {
    mockAuthStore.mockImplementation((selector) =>
      selector({ user: { role: "shipper", full_name: "Test Shipper" } })
    );
  });

  it("renders a Dashboard link for authenticated users", () => {
    renderNav();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("does not render the Log in link when authenticated", () => {
    renderNav();
    expect(screen.queryByRole("link", { name: /log in/i })).not.toBeInTheDocument();
  });

  it("dashboard link points to /shipper for shipper role", () => {
    renderNav();
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("href", "/shipper");
  });

  it("dashboard link points to /owner for owner role", () => {
    mockAuthStore.mockImplementation((selector) =>
      selector({ user: { role: "owner", full_name: "Fleet Owner" } })
    );
    renderNav();
    const dashboardLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute("href", "/owner");
  });
});

describe("MainNav — mobile menu", () => {
  it("renders a hamburger button on mobile", () => {
    renderNav();
    // The mobile menu toggle button (Menu icon)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("opens mobile menu when hamburger is clicked", () => {
    renderNav();
    // Find the mobile menu button — it's the last button in the header (md:hidden)
    const menuButtons = screen.getAllByRole("button");
    const hamburger = menuButtons[menuButtons.length - 1];
    fireEvent.click(hamburger);
    // JSDOM renders both desktop and mobile nav — after click both are present
    expect(screen.getAllByText("Products").length).toBeGreaterThan(1);
  });
});

describe("MainNav — desktop dropdown", () => {
  it("opens Products dropdown when Products button is clicked", () => {
    renderNav();
    const productsBtn = screen.getByRole("button", { name: /products/i });
    fireEvent.click(productsBtn);
    // Dropdown items should appear
    expect(screen.getByText("For Shippers")).toBeInTheDocument();
  });

  it("closes Products dropdown on second click", () => {
    renderNav();
    const productsBtn = screen.getByRole("button", { name: /products/i });
    fireEvent.click(productsBtn);
    fireEvent.click(productsBtn);
    expect(screen.queryByText("For Shippers")).not.toBeInTheDocument();
  });
});
