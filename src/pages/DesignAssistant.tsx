import { MainLayout } from "@/components/layout/MainLayout";
import { DesignDashboard } from "@/components/dashboard/DesignDashboard";

const DesignAssistant = () => {
  return (
    <MainLayout currentView="design">
      <DesignDashboard />
    </MainLayout>
  );
};

export default DesignAssistant;
