import type { ComponentProps, ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

type MainLayoutProps = {
  sidebarProps: ComponentProps<typeof Sidebar>;
  headerProps: ComponentProps<typeof Header>;
  children: ReactNode;
  overlays?: ReactNode;
};

export default function MainLayout({
  sidebarProps,
  headerProps,
  children,
  overlays,
}: MainLayoutProps) {
  return (
    <main className="shell">
      <Sidebar {...sidebarProps} />

      <style>{`.listPagination{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 16px;border-top:1px solid #f0edf4}.paginationSummary{font-size:12px;color:#777487}.paginationSummary b{color:#4b3a60}.paginationControls{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.paginationSize{display:flex;align-items:center;gap:7px;margin-right:7px;color:#777487;font-size:11px;font-weight:600}.paginationSize select{height:32px;padding:0 8px;border:1px solid #e1e2ea;border-radius:8px;background:#fff;color:#454253;font:500 12px inherit}.paginationButton{min-width:32px;height:32px;padding:0 9px;border:1px solid #e5e2eb;border-radius:8px;background:#fff;color:#686579;font:600 11px inherit;cursor:pointer}.paginationButton:hover:not(:disabled){border-color:#c7a5e8;color:#7022bd}.paginationButton.active{border-color:#7a1bd8;background:#f5edff;color:#7020c5}.paginationButton:disabled{opacity:.4;cursor:not-allowed}.paginationDots{padding:0 3px;color:#858397}@media(max-width:620px){.listPagination{align-items:flex-start}.paginationControls{width:100%}.paginationSize{margin-right:auto}}`}</style>

      <section className="main">
        <Header {...headerProps} />
        {children}
        <Footer />
      </section>

      {overlays}
    </main>
  );
}