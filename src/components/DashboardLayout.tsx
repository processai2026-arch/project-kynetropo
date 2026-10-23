/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useState, createContext } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopNavbar } from "@/components/TopNavbar";
import { ChatContextProvider } from "@/contexts/ChatContext";
import { ChatWidget } from "@/components/ChatWidget";
import { ModulesDialog } from "@/components/ModulesDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { PullIndicator, usePullToRefresh } from "@/components/phone/PullToRefresh";

interface DashboardLayoutContextType {
  modulesDialogOpen: boolean;
  setModulesDialogOpen: (open: boolean) => void;
}

export const DashboardLayoutContext = createContext<DashboardLayoutContextType | undefined>(
  undefined
);

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [modulesDialogOpen, setModulesDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const { pathname } = useLocation();

  /*
   * On a phone, the sales module is its own app: bottom tabs and nothing else.
   * The sidebar, the module switcher, the fullscreen and notification buttons
   * and the chat widget all belong to the desktop operations tool and only get
   * in the way on a 5-inch screen — so the whole surrounding chrome is dropped
   * and the page is rendered on its own. Desktop is completely unaffected.
   */
  const salesAppShell = isMobile && pathname.startsWith("/sales");
  // The phone app reloads on a pull from the top, and every screen opens at its top (Diamond Fencing's shell).
  const pull = usePullToRefresh(salesAppShell);
  useEffect(() => { if (salesAppShell) window.scrollTo(0, 0); }, [pathname, salesAppShell]);

  // Load this tenant's company profile once so generated documents (invoices,
  // quotations) show the tenant's own name/address/GSTIN — not a hardcoded one.
  useEffect(() => { import("@/lib/companyProfile").then((m) => m.loadCompanyProfile()); }, []);

  if (salesAppShell) {
    return (
      <DashboardLayoutContext.Provider value={{ modulesDialogOpen, setModulesDialogOpen }}>
        <PullIndicator {...pull} />
        <main className="mx-auto min-h-[100dvh] w-full max-w-2xl bg-background p-4">{children}</main>
      </DashboardLayoutContext.Provider>
    );
  }

  return (
    <ChatContextProvider>
      {/*
        Diamond Fencing's sizes: 16rem open, a 5.25rem rail collapsed (not
        shadcn's 3rem) so each item keeps a readable label under its glyph.
        Open by default; the brand at the top of the sidebar collapses it.
      */}
      <SidebarProvider style={{ "--sidebar-width-icon": "5.25rem" } as React.CSSProperties}>
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
