import { Outlet } from "react-router-dom";
import MainNav from "@/components/layout/MainNav";
import Footer from "@/components/layout/Footer";

export default function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 antialiased">
      <MainNav />

      {/* ── Page content ── */}
      <main className="flex-1 pt-[72px]">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
