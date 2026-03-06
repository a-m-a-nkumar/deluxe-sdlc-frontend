import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectOverview } from "@/components/dashboard/ProjectOverview";

const Dashboard = () => {
  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="overview">
        <ProjectOverview />
      </MainLayout>
    </div>
  );
};

export default Dashboard;
