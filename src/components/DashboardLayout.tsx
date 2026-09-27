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

  // Load this tenant's company profile once so generated documents (invoices,
  // quotations) show the tenant's own name/address/GSTIN — not a hardcoded one.
  useEffect(() => { import("@/lib/companyProfile").then((m) => m.loadCompanyProfile()); }, []);

  if (salesAppShell) {
    return (
      <DashboardLayoutContext.Provider value={{ modulesDialogOpen, setModulesDialogOpen }}>
        <main className="min-h-screen w-full bg-background p-4">{children}</main>
      </DashboardLayoutContext.Provider>
    );
  }

  return (
    <ChatContextProvider>
      {/*
        Collapsed is the default. The rail carries the icon AND its name, so
        collapsed is still a readable menu rather than a memory test — and it
        gives the page back roughly 150px, which is the difference between a
        table fitting and not fitting on a laptop.

        6.5rem, not the shadcn default of 3rem: a 48px rail can only hold a
        glyph. This one holds a two-line label under it.
      */}
      <SidebarProvider
        defaultOpen={false}
        style={{ "--sidebar-width-icon": "6.5rem" } as React.CSSProperties}
      >
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
