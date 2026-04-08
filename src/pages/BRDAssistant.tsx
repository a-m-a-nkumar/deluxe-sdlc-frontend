import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { BRDDashboard } from "@/components/dashboard/BRDDashboard";
import { AnalystAgentContent } from "@/pages/AnalystAgent";
import { useNavigate, useLocation } from "react-router-dom";
import { useAppState } from "@/contexts/AppStateContext";
import { toast } from "sonner";
import { fetchProjectBrdSession, fetchBrdSections, fetchBrdHistory } from "@/services/projectApi";
import { SessionManager } from "@/services/chatbotApi";
import { FileText, Sparkles, ArrowRight, Upload, MessageSquare, ArrowLeftRight } from "lucide-react";
import { colors } from "@/config/theme";

const BRDAssistant = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [brdMode, setBrdMode] = useState<"pending" | "agent-pm" | "analyst">("pending");

  // Reset to card selection when user clicks "BRD Assistant" in sidebar again
  useEffect(() => {
    setBrdMode("pending");
  }, [location.key]);

  // Scroll to top when switching workflows so the mode indicator and switch button are visible
  useEffect(() => {
    if (brdMode !== "pending") {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [brdMode]);

  const handleBack = () => {
    navigate("/");
  };

  // Notify user if they land on the page with no project selected
  useEffect(() => {
    if (!selectedProject) {
      toast.warning("No project selected. Please select a project to start generating a BRD.");
    }
  }, []);

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

        {/* Card Selection Screen */}
        {brdMode === "pending" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.08)` }}>
              <FileText className="w-7 h-7" style={{ color: colors.brand }} />
            </div>
            <h2 className="text-lg font-semibold mb-1" style={{ color: "#1a1a1a" }}>Choose your BRD workflow</h2>
            <p className="text-sm text-gray-500 mb-8 text-center max-w-md">
              Select how you want to create your Business Requirements Document
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full max-w-2xl">

              {/* Card 1 — Agent PM */}
              <button
                onClick={() => setBrdMode("agent-pm")}
                className="group relative flex flex-col rounded-xl border-2 border-gray-200 bg-white hover:border-green-500 hover:shadow-lg transition-all text-left overflow-hidden"
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: "#16a34a" }} />
                <div className="p-5 flex flex-col gap-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(22, 163, 74, 0.1)" }}>
                      <FileText className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Agent PM</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-600">Document-based</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed">
                    Create BRD using supporting documents with <span className="font-medium text-gray-700">AI-assisted editing</span> — section by section or all at once.
                  </p>

                  <div className="space-y-2.5 mt-1">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: "#16a34a" }}>1</div>
                      <p className="text-xs text-gray-600">Upload supporting documents (PDFs, meeting notes, etc.)</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: "#16a34a" }}>2</div>
                      <p className="text-xs text-gray-600">AI generates BRD sections from your documents</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: "#16a34a" }}>3</div>
                      <p className="text-xs text-gray-600">Edit sections with AI assistance, then push to Confluence</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100">
                    <Upload className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-xs font-medium text-green-600">Start with documents</span>
                    <ArrowRight className="w-3.5 h-3.5 text-green-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </button>

              {/* Card 2 — Analyst Agent */}
              <button
                onClick={() => setBrdMode("analyst")}
                className="group relative flex flex-col rounded-xl border-2 border-gray-200 bg-white hover:border-primary hover:shadow-lg transition-all text-left overflow-hidden"
              >
                <div className="h-1.5 w-full" style={{ backgroundColor: colors.brand }} />
                <div className="p-5 flex flex-col gap-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.08)` }}>
                      <Sparkles className="w-5 h-5" style={{ color: colors.brand }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1a1a1a" }}>Analyst Agent</p>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.06)`, color: colors.brand }}>Conversational</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed">
                    No documents needed — have a conversation with our <span className="font-medium text-gray-700">AI analyst who will gather requirements</span> and auto-generate the BRD.
                  </p>

                  <div className="space-y-2.5 mt-1">
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: colors.brand }}>1</div>
                      <p className="text-xs text-gray-600">Start a conversation with the AI analyst</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: colors.brand }}>2</div>
                      <p className="text-xs text-gray-600">Answer questions — AI fills BRD sections automatically</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-white" style={{ backgroundColor: colors.brand }}>3</div>
                      <p className="text-xs text-gray-600">Review, download as .docx, or push to Confluence</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100">
                    <MessageSquare className="w-3.5 h-3.5" style={{ color: colors.brand }} />
                    <span className="text-xs font-medium" style={{ color: colors.brand }}>Start conversation</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: colors.brand }} />
                  </div>
                </div>
              </button>

            </div>
          </div>
        )}

        {/* Mode indicator + Change button (shown when a workflow is selected) */}
        {brdMode !== "pending" && (
          <>
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 pt-4">
              <div className="flex items-center gap-2">
                {brdMode === "agent-pm" ? (
                  <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-600">
                    <FileText className="w-3 h-3" />
                    Agent PM
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: `rgba(${colors.brandRgb}, 0.06)`, color: colors.brand }}>
                    <Sparkles className="w-3 h-3" />
                    Analyst Agent
                  </div>
                )}
              </div>
              <button
                onClick={() => setBrdMode("pending")}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-400 hover:text-red-700 transition-all shadow-sm"
              >
                <ArrowLeftRight className="w-3 h-3" />
                Switch workflow
              </button>
            </div>

            {/* Render selected workflow */}
            {brdMode === "agent-pm" && (
              <BRDDashboard
                onBack={handleBack}
                selectedProject={selectedProject}
                selectedBRDTemplate={null}
                isRestoringSession={isRestoringSession}
              />
            )}

            {brdMode === "analyst" && (
              <AnalystAgentContent />
            )}
          </>
        )}

      </MainLayout>
    </div>
  );
};

export default BRDAssistant;
