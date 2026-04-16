import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectOverview } from "@/components/dashboard/ProjectOverview";
import { useAuth } from "@/contexts/AuthContext";
import AccessDenied from "./AccessDenied";

const Dashboard = () => {
  const { user } = useAuth();

  // User is authenticated but has no module access
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
