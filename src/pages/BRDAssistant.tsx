import { MainLayout } from "@/components/layout/MainLayout";
import { BRDDashboard } from "@/components/dashboard/BRDDashboard";
import { useNavigate } from "react-router-dom";

const BRDAssistant = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="brd" showBackButton onBack={handleBack}>
        <BRDDashboard onBack={handleBack} selectedProject={null} selectedBRDTemplate={null} />
      </MainLayout>
    </div>
  );
};

export default BRDAssistant;
