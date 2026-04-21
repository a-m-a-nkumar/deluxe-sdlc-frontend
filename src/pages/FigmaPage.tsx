import { MainLayout } from "@/components/layout/MainLayout";
import { FigmaDesignDashboard } from "@/components/dashboard/FigmaDesignDashboard";

const FigmaPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="figma">
        <FigmaDesignDashboard />
      </MainLayout>
    </div>
  );
};

export default FigmaPage;
