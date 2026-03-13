import { MainLayout } from "@/components/layout/MainLayout";
import { ConfluenceDashboard } from "@/components/dashboard/ConfluenceDashboard";

const ConfluencePage = () => {
  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="confluence">
        <ConfluenceDashboard />
      </MainLayout>
    </div>
  );
};

export default ConfluencePage;
