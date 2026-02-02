import { useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BRDDashboard } from "@/components/dashboard/BRDDashboard";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/contexts/AppStateContext";
import { toast } from "sonner";

const BRDAssistant = () => {
  const navigate = useNavigate();
  const {
    selectedProject,
    setChatMessages,
    setBrdSections,
    setBrdId,
    setPendingUploadResponse
  } = useAppState();

  const handleBack = () => {
    navigate("/");
  };

  // Clear BRD data when project changes
  useEffect(() => {
    if (selectedProject) {
      console.log(`[BRDAssistant] Project changed to: ${selectedProject.project_name} (${selectedProject.project_id})`);

      // Clear all BRD-related data
      setChatMessages("brd", []);
      setBrdSections([]);
      setBrdId(null);
      setPendingUploadResponse(null);

      toast.info(`Switched to project: ${selectedProject.project_name}`);
    }
  }, [selectedProject?.project_id]);

  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="brd" showBackButton onBack={handleBack}>
        <BRDDashboard onBack={handleBack} selectedProject={selectedProject} selectedBRDTemplate={null} />
      </MainLayout>
    </div>
  );
};

export default BRDAssistant;
