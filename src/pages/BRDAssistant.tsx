import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BRDDashboard } from "@/components/dashboard/BRDDashboard";
import { useNavigate } from "react-router-dom";
import { useAppState } from "@/contexts/AppStateContext";
import { toast } from "sonner";
import { fetchProjectBrdSession, fetchBrdSections, fetchBrdHistory } from "@/services/projectApi";
import { SessionManager } from "@/services/chatbotApi";

const BRDAssistant = () => {
  const navigate = useNavigate();
  const {
    selectedProject,
    setChatMessages,
    setBrdSections,
    setBrdId,
    setPendingUploadResponse,
    addUploadedFileBatch,
    clearUploadedFileBatches
  } = useAppState();

  const [isRestoringSession, setIsRestoringSession] = useState(false);

  const handleBack = () => {
    navigate("/");
  };

  // Restore or clear BRD data when project changes
  useEffect(() => {
    if (!selectedProject) return;

    const projectId = selectedProject.project_id;
    console.log(`[BRDAssistant] Project changed to: ${selectedProject.project_name} (${projectId})`);

    // Clear current state first (including uploaded file batches from previous project)
    setChatMessages("brd", []);
    setBrdSections([]);
    setBrdId(null);
    setPendingUploadResponse(null);
    clearUploadedFileBatches();
    setIsRestoringSession(true);

    // Then try to restore saved session
    (async () => {
      try {
        const savedSession = await fetchProjectBrdSession(projectId);

        if (savedSession?.brd_id) {
          const brdId = savedSession.brd_id;

          // 1. Restore brd_id into context
          setBrdId(brdId);
          console.log(`[BRDAssistant] Restored brd_id: ${brdId}`);

          // 2. Fetch sections from S3 (source of truth)
          try {
            const s3Sections = await fetchBrdSections(brdId);
            if (s3Sections.length > 0) {
              const mappedSections = s3Sections.map((s) => ({
                title: s.title,
                sectionNumber: s.number,
                description: "",
                content: ""
              }));
              setBrdSections(mappedSections);
              console.log(`[BRDAssistant] Restored ${mappedSections.length} sections from S3`);
            }
          } catch (secErr) {
            console.warn("[BRDAssistant] Could not fetch sections from S3:", secErr);
          }

          // 3. Restore session_id in SessionManager for ongoing chat
          if (savedSession.session_id) {
            SessionManager.setSessionId(savedSession.session_id, projectId);
            console.log(`[BRDAssistant] Restored session_id: ${savedSession.session_id}`);
          }

          // 4. Add synthetic uploaded-file batch so the UI unlocks
          //    (BRDDashboard disables chat/sections when uploadedFileBatches is empty)
          addUploadedFileBatch({
            id: `restored-${brdId}`,
            files: [{ name: "Restored BRD", size: "—" }],
            contentPreview: "Previously generated BRD restored from session.",
            timestamp: new Date().toISOString()
          });

          // 5. Fetch BRD chat history from DB (with AgentCore Memory fallback)
          try {
            const sessionId = savedSession.session_id || `brd-session-${brdId}`;
            const historyMessages = await fetchBrdHistory(sessionId, projectId);
            if (historyMessages && historyMessages.length > 0) {
              const restoredMessages = historyMessages.map((m, idx) => ({
                id: `restored-${idx}`,
                content: m.content || "",
                isBot: m.role === "assistant" || m.isBot === true,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              }));
              setChatMessages("brd", restoredMessages);
              console.log(`[BRDAssistant] Restored ${restoredMessages.length} chat messages`);
            }
          } catch (histErr) {
            console.warn("[BRDAssistant] Could not restore chat history:", histErr);
          }

          toast.info(`Restored BRD session for: ${selectedProject.project_name}`);
        } else {
          toast.info(`Switched to project: ${selectedProject.project_name}`);
        }
      } catch (err) {
        console.warn("[BRDAssistant] Error restoring session:", err);
        toast.info(`Switched to project: ${selectedProject.project_name}`);
      } finally {
        setIsRestoringSession(false);
      }
    })();
  }, [selectedProject?.project_id]);

  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="brd" showBackButton onBack={handleBack}>
        <BRDDashboard
          onBack={handleBack}
          selectedProject={selectedProject}
          selectedBRDTemplate={null}
          isRestoringSession={isRestoringSession}
        />
      </MainLayout>
    </div>
  );
};

export default BRDAssistant;
