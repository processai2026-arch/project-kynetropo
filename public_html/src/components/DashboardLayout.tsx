import React, { useEffect, useState, createContext } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopNavbar } from "@/components/TopNavbar";
import { ChatContextProvider } from "@/contexts/ChatContext";
import { ChatWidget } from "@/components/ChatWidget";
import { ModulesDialog } from "@/components/ModulesDialog";

interface DashboardLayoutContextType {
  modulesDialogOpen: boolean;
  setModulesDialogOpen: (open: boolean) => void;
}

export const DashboardLayoutContext = createContext<DashboardLayoutContextType | undefined>(
  undefined
);

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [modulesDialogOpen, setModulesDialogOpen] = useState(false);

  // Load this tenant's company profile once so generated documents (invoices,
  // quotations) show the tenant's own name/address/GSTIN — not a hardcoded one.
  useEffect(() => { import("@/lib/companyProfile").then((m) => m.loadCompanyProfile()); }, []);

  // Global: mouse wheel over any overflow-x-auto table → scroll horizontally
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      // Only act on predominantly-vertical wheel events
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      const target = e.target as Element | null;
      const scrollable = target?.closest(".overflow-x-auto") as HTMLElement | null;
      if (!scrollable) return;

      const hasH = scrollable.scrollWidth > scrollable.clientWidth + 2;
      const hasV = scrollable.scrollHeight > scrollable.clientHeight + 2;

      // Only convert when the element itself can't scroll vertically
      // (the table content area — page still scrolls vertically via main)
      if (!hasH || hasV) return;

      e.preventDefault();
      scrollable.scrollLeft += e.deltaY;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <ChatContextProvider>
      <SidebarProvider>
        <DashboardLayoutContext.Provider value={{ modulesDialogOpen, setModulesDialogOpen }}>
          <div className="min-h-screen flex w-full">
            <AppSidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TopNavbar />
              <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
            </div>
          </div>
          <ModulesDialog open={modulesDialogOpen} onOpenChange={setModulesDialogOpen} />
          <ChatWidget />
        </DashboardLayoutContext.Provider>
      </SidebarProvider>
    </ChatContextProvider>
  );
}
