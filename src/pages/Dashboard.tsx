import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectOverview } from "@/components/dashboard/ProjectOverview";
import { useAuth } from "@/contexts/AuthContext";
import AccessDenied from "./AccessDenied";
import ServiceUnavailable from "./ServiceUnavailable";

const Dashboard = () => {
  const { user, permissionsUnavailable } = useAuth();

  // Backend's Graph fallback was unreachable — transient, retryable. Render
  // a distinct page rather than the permanent AccessDenied (which would
  // mislead overage users into thinking they were denied when really we
  // just couldn't check).
  if (permissionsUnavailable) {
    return <ServiceUnavailable />;
  }

  // User is authenticated but has no module access (genuine — they're not in
  // any SDLC Azure AD group).
  if (user && user.allowedModules.length === 0) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="overview">
        <ProjectOverview />
      </MainLayout>
    </div>
  );
};

export default Dashboard;
