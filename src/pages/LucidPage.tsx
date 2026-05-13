import { MainLayout } from "@/components/layout/MainLayout";
import { LucidDashboard } from "@/components/dashboard/LucidDashboard";

const LucidPage = () => {
  return (
    <MainLayout currentView="lucid">
      <LucidDashboard />
    </MainLayout>
  );
};

export default LucidPage;
