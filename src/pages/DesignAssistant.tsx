import { MainLayout } from "@/components/layout/MainLayout";
import { DesignDashboard } from "@/components/dashboard/DesignDashboard";

const DesignAssistant = () => {
  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="design">
        <DesignDashboard />
      </MainLayout>
    </div>
  );
};

export default DesignAssistant;
