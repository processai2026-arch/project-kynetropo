import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import NotFound from "./pages/NotFound";

// Core
const Dashboard    = lazy(() => import("./pages/Dashboard"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const Login        = lazy(() => import("./pages/Login"));

// CRM
const Clients      = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Projects     = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));

// Delivery
const Bugs       = lazy(() => import("./pages/Bugs"));
const BugDetail  = lazy(() => import("./pages/BugDetail"));
const Meetings   = lazy(() => import("./pages/Meetings"));

// Finance
const Finance = lazy(() => import("./pages/Finance"));
const AMC     = lazy(() => import("./pages/AMC"));

// Growth
const Pitches     = lazy(() => import("./pages/Pitches"));
const PitchDetail = lazy(() => import("./pages/PitchDetail"));

// Team
const Hiring    = lazy(() => import("./pages/Hiring"));
const Employees = lazy(() => import("./pages/Employees"));

// Sales (lead → call → follow-up → meeting → onboarding → customer, + challenges)
const SalesDashboard       = lazy(() => import("./pages/sales/SalesDashboard"));
const SalesLeads           = lazy(() => import("./pages/sales/SalesLeads"));
const SalesLeadDetail      = lazy(() => import("./pages/sales/SalesLeadDetail"));
const SalesFollowUps       = lazy(() => import("./pages/sales/SalesFollowUps"));
const SalesMeetings        = lazy(() => import("./pages/sales/SalesMeetings"));
const SalesChallenges      = lazy(() => import("./pages/sales/SalesChallenges"));
const SalesChallengeDetail = lazy(() => import("./pages/sales/SalesChallengeDetail"));
const SalesCallHistory     = lazy(() => import("./pages/sales/SalesCallHistory"));
const SalesActivity        = lazy(() => import("./pages/sales/SalesActivity"));
const SalesAccessControl   = lazy(() => import("./pages/sales/SalesAccessControl"));
const SalesTasks           = lazy(() => import("./pages/sales/SalesTasks"));
const SalesMore            = lazy(() => import("./pages/sales/SalesMore"));

// System
const UserManagement = lazy(() => import("./pages/UserManagement"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

function ProtectedRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <DashboardLayout>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/"                element={<Dashboard />} />
          {/* CRM */}
          <Route path="/clients"         element={<Clients />} />
          <Route path="/clients/:id"     element={<ClientDetail />} />
          <Route path="/projects"        element={<Projects />} />
          <Route path="/projects/:id"    element={<ProjectDetail />} />
          {/* Delivery */}
          <Route path="/bugs"            element={<Bugs />} />
          <Route path="/bugs/:id"        element={<BugDetail />} />
          <Route path="/meetings"        element={<Meetings />} />
          {/* Finance */}
          <Route path="/finance"         element={<Finance />} />
          <Route path="/amc"             element={<AMC />} />
          {/* Growth */}
          <Route path="/pitches"         element={<Pitches />} />
          <Route path="/pitches/:id"     element={<PitchDetail />} />
          {/* Sales */}
          <Route path="/sales"                 element={<SalesDashboard />} />
          <Route path="/sales/leads"           element={<SalesLeads />} />
          <Route path="/sales/leads/:id"       element={<SalesLeadDetail />} />
          <Route path="/sales/followups"       element={<SalesFollowUps />} />
          <Route path="/sales/meetings"        element={<SalesMeetings />} />
          <Route path="/sales/tasks"           element={<SalesTasks />} />
          <Route path="/sales/challenges"      element={<SalesChallenges />} />
          <Route path="/sales/challenges/:id"  element={<SalesChallengeDetail />} />
          <Route path="/sales/calls"           element={<SalesCallHistory />} />
          <Route path="/sales/activity"        element={<SalesActivity />} />
          <Route path="/sales/access-control"  element={<SalesAccessControl />} />
          <Route path="/sales/more"            element={<SalesMore />} />
          {/* Team */}
          <Route path="/hiring"          element={<Hiring />} />
          <Route path="/employees"       element={<Employees />} />
          {/* System */}
          <Route path="/user-management" element={<UserManagement />} />
          <Route path="/settings"        element={<SettingsPage />} />
          <Route path="*"                element={<NotFound />} />
        </Routes>
      </Suspense>
    </DashboardLayout>
  );
}

function LoginRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Login />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ConfirmProvider>
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/login"   element={<LoginRoute />} />
                  <Route path="/*"       element={<ProtectedRoutes />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </ConfirmProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
