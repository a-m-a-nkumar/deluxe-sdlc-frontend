import { MainLayout } from "@/components/layout/MainLayout";
import { BRDSyncDashboard } from "@/components/brd-sync/BRDSyncDashboard";
import { useNavigate } from "react-router-dom";

const BRDSyncPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="brd-sync" showBackButton onBack={() => navigate("/")}>
        <BRDSyncDashboard />
      </MainLayout>
    </div>
  );
};

export default BRDSyncPage;
