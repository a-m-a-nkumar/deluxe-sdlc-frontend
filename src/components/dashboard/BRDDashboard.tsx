import { useState, useEffect } from "react";
import { BRDProgress } from "../brd/BRDProgress";
import { ChatInterface } from "../chat/ChatInterface";
import { FileUploadSection } from "../files/FileUploadSection";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useAppState } from "@/contexts/AppStateContext";
import { useNavigate } from "react-router-dom";
import { sendChatMessage } from "@/services/chatbotApi";
import { parseBRDSections } from "@/utils/brdParser";
import { fetchBrdSectionContent } from "@/services/projectApi";
const sectionContent = {
  "Executive Summary": {
    title: "Executive Summary Assistant",
    subtitle: "Get help creating a comprehensive executive summary for your BRD",
    initialMessage: "Hello! 👋 I'm here to help you create an executive summary for your Payment Gateway project.\n\nAn executive summary should provide a high-level overview including:\n• Project purpose and scope\n• Key stakeholders\n• Business value and ROI\n• Timeline and budget overview\n\nWhat specific aspect would you like to focus on first?",
    placeholder: "Ask about executive summary requirements..."
  },
  "Stakeholders": {
    title: "Stakeholder Analysis Assistant",
    subtitle: "Identify and document key stakeholders for your project",
    initialMessage: "Hello! 👋 Let's identify the key stakeholders for your Payment Gateway project.\n\nWe should document:\n• Primary stakeholders (project sponsors, end users)\n• Secondary stakeholders (IT teams, compliance)\n• External stakeholders (payment processors, banks)\n• Their roles, responsibilities, and influence levels\n\nWho are the main stakeholders you've identified so far?",
    placeholder: "Describe your stakeholders..."
  },
  "Business Objectives": {
    title: "Business Objectives Assistant",
    subtitle: "Define clear business goals and success criteria",
    initialMessage: "Hello! 👋 Let's define the business objectives for your Payment Gateway project.\n\nWe should establish:\n• Primary business goals\n• Success metrics and KPIs\n• ROI expectations\n• Risk mitigation objectives\n• Compliance requirements\n\nWhat are the main business drivers for this payment gateway?",
    placeholder: "Describe your business objectives..."
  },
  "Functional Requirements": {
    title: "Functional Requirements Assistant",
    subtitle: "Document what the system must do",
    initialMessage: "Hello! 👋 Let's document the functional requirements for your Payment Gateway.\n\nWe should cover:\n• Payment processing capabilities\n• Supported payment methods\n• User interface requirements\n• Integration requirements\n• Transaction handling\n• Reporting features\n\nWhat payment processing features are most critical for your system?",
    placeholder: "Describe functional requirements..."
  },
  "Data Requirements": {
    title: "Data Requirements Assistant",
    subtitle: "Define data storage and processing needs",
    initialMessage: "Hello! 👋 Let's define the data requirements for your Payment Gateway.\n\nWe should document:\n• Transaction data structure\n• Customer data requirements\n• Data storage and retention policies\n• Data flow between systems\n• Backup and recovery requirements\n• Data encryption needs\n\nWhat types of transaction data will your system need to handle?",
    placeholder: "Describe data requirements..."
  },
  "Security Requirements": {
    title: "Security Requirements Assistant",
    subtitle: "Ensure security and compliance standards",
    initialMessage: "Hello! 👋 Let's establish security requirements for your Payment Gateway.\n\nWe must address:\n• PCI DSS compliance\n• Data encryption standards\n• Authentication and authorization\n• Fraud detection and prevention\n• Security monitoring and logging\n• Vulnerability management\n\nWhat security standards does your organization need to comply with?",
    placeholder: "Describe security requirements..."
  }
};
interface BRDDashboardProps {
  onBack?: () => void;
  selectedProject?: any;
  selectedBRDTemplate?: string | null;
  isRestoringSession?: boolean;
}
export const BRDDashboard = ({
  onBack,
  selectedProject,
  selectedBRDTemplate,
  isRestoringSession = false
}: BRDDashboardProps) => {
  // const navigate = useNavigate(); // Removed: analyst button moved to card selection
  const {
    chatMessages,
    setChatMessages,
    selectedProject: contextProject,
    selectedBRDTemplate: contextTemplate,
    pendingUploadResponse,
    setPendingUploadResponse,
    uploadedFileBatches,
    brdSections,
    setBrdSections,
    brdId,
    setBrdId
  } = useAppState();
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [isFetchingSection, setIsFetchingSection] = useState(false);

  // Auto-select first section when brdSections are loaded
  useEffect(() => {
    if (brdSections.length > 0 && !selectedSection) {
      setSelectedSection(brdSections[0].title);
    }
  }, [brdSections, selectedSection]);

  // Fetch section content from S3 (fast display) and also send through agent
  // so it gets stored in AgentCore memory for LLM context.
  const fetchSectionContent = async (sectionTitle: string): Promise<string | null> => {
    if (!brdId || !sectionTitle || isFetchingSection) {
      return null;
    }

    try {
      setIsFetchingSection(true);

      const section = brdSections.find(s => s.title === sectionTitle);
      const sectionNumber = section?.sectionNumber;
      let sectionMarkdown: string | null = null;

      // 1. Fast path: fetch from S3 for immediate display
      if (sectionNumber) {
        try {
          const s3Section = await fetchBrdSectionContent(brdId, sectionNumber);
          if (s3Section?.markdown) {
            sectionMarkdown = s3Section.markdown;
            // Update section state immediately
            const updatedSections = brdSections.map(s =>
              s.title === sectionTitle
                ? { ...s, content: sectionMarkdown! }
                : s
            );
            setBrdSections(updatedSections);
          }
        } catch (s3Err) {
          console.warn("S3 section fetch failed, falling back to agent chat:", s3Err);
        }
      }

      // 2. Send "show section N" through the agent so it gets into AgentCore memory.
      //    This gives the LLM context about which section the user is viewing.
      const showCommand = sectionNumber
        ? `show section ${sectionNumber}`
        : `show section ${sectionTitle}`;

      // Fire agent call — if S3 already returned content we don't need to wait,
      // but we still want it in memory. If S3 failed, this is the fallback.
      try {
        const agentResponse = await sendChatMessage(showCommand, brdId);
        if (agentResponse?.response) {
          // If we didn't get content from S3, use the agent response
          if (!sectionMarkdown) {
            sectionMarkdown = agentResponse.response;
            const updatedSections = brdSections.map(s =>
              s.title === sectionTitle
                ? { ...s, content: sectionMarkdown! }
                : s
            );
            setBrdSections(updatedSections);
          }
        }
      } catch (agentErr) {
        console.warn("Agent call for memory persistence failed:", agentErr);
      }

      return sectionMarkdown;
    } catch (error) {
      console.error("Error fetching section content:", error);
      return null;
    } finally {
      setIsFetchingSection(false);
    }
  };

  // Check for pending upload response on mount and add to chat
  useEffect(() => {
    if (pendingUploadResponse) {
      const content = pendingUploadResponse.brd_auto_generated?.content_preview || pendingUploadResponse.message || 'File uploaded successfully';

      // Store BRD ID if available
      if (pendingUploadResponse.brd_auto_generated?.brd_id) {
        setBrdId(pendingUploadResponse.brd_auto_generated.brd_id);
      }

      // Parse the content to extract dynamic sections
      const parsedSections = parseBRDSections(content);
      if (parsedSections.length > 0) {
        setBrdSections(parsedSections);
      }

      const botMessage = {
        id: `bot-${Date.now()}`,
        content: content,
        isBot: true,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      const currentMessages = chatMessages.brd || [];
      // Only add if not already in messages
      const messageExists = currentMessages.some(msg => msg.content === botMessage.content);
      if (!messageExists) {
        setChatMessages("brd", [...currentMessages, botMessage]);
      }
      // Clear the pending response after adding to chat
      setPendingUploadResponse(null);
    }
  }, [pendingUploadResponse, chatMessages.brd, setChatMessages, setPendingUploadResponse, setBrdSections, setBrdId]);

  // Function to parse BRD sections from API response
  // Function to parse BRD sections from API response - now using shared utility
  /* const parseBRDSections = (content: string) => { ... } */

  const handleSectionReviewed = () => {
    // Mark current section as completed
    if (!completedSections.includes(selectedSection)) {
      setCompletedSections([...completedSections, selectedSection]);
    }

    // Move to next section
    const currentIndex = brdSections.findIndex(s => s.title === selectedSection);
    if (currentIndex < brdSections.length - 1) {
      const nextSection = brdSections[currentIndex + 1];
      setSelectedSection(nextSection.title);
    }
  };

  const handleFileUploadSuccess = (response?: any) => {
    // Response is already handled by global state and useEffect
  };

  const handleSectionTabClick = async (title: string, description: string) => {
    // Block clicks while a section is already being fetched
    if (isFetchingSection) {
      return;
    }

    // Update selected section when clicking a tab
    setSelectedSection(title);

    // Fetch content from S3 + send to agent for memory
    const sectionMarkdown = await fetchSectionContent(title);

    // Display the section content in the chat window
    const displayContent = sectionMarkdown
      || brdSections.find(s => s.title === title)?.content
      || description;

    if (displayContent) {
      const currentMessages = chatMessages.brd || [];
      const newMessage = {
        id: `section-${Date.now()}`,
        content: `**${title}**\n\n${displayContent}`,
        isBot: true,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
      setChatMessages("brd", [...currentMessages, newMessage]);
    }
  };

  const handleResponseReceived = async (response: string) => {
    // Check if the response indicates a successful section update
    const isUpdateSuccess = response.toLowerCase().includes("updated successfully") ||
      response.includes("✅") ||
      response.toLowerCase().includes("section") && response.toLowerCase().includes("updated");

    // Update the BRD section content with the AI response
    if (selectedSection) {
      const updatedSections = brdSections.map(section =>
        section.title === selectedSection
          ? { ...section, content: response }
          : section
      );
      setBrdSections(updatedSections);

      // If this was a successful update, fetch fresh content from backend
      if (isUpdateSuccess && brdId) {
        // Small delay to ensure backend has saved the update
        setTimeout(async () => {
          await fetchSectionContent(selectedSection);
        }, 500);
      }
    }
  };
  return <div className="p-4 sm:p-6 lg:p-8 bg-white">
    <div className="mb-4 lg:mb-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2 hover:bg-accent">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl font-bold sm:text-base">{contextProject?.project_name || "No Project Selected"}</h1>
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8 items-stretch scrollbar-thin-muted">
      <div className="lg:col-span-3 order-1 lg:order-1">
        <BRDProgress
          selectedSection={selectedSection}
          onSectionChange={setSelectedSection}
          completedSections={completedSections}
          hasProjectAndTemplate={!!(contextProject && contextTemplate)}
          disabled={uploadedFileBatches.length === 0}
          onSectionClick={handleSectionTabClick}
          showDocumentOverview={uploadedFileBatches.length > 0}
          dynamicSections={brdSections}
          isFetchingSection={isFetchingSection}
          isLoadingSections={isRestoringSession && brdSections.length === 0}
          onViewEntireBRD={brdId ? async () => {
            try {
              const response = await sendChatMessage("show entire brd", brdId);
              const content = response?.response || response?.message || "Full BRD loaded.";
              setChatMessages("brd", [...(chatMessages.brd || []), {
                id: `full-brd-${Date.now()}`,
                content,
                isBot: true,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              }]);
            } catch (e) {
              console.error("Failed to load full BRD:", e);
            }
          } : undefined}
        />
      </div>

      <div className="lg:col-span-6 order-3 lg:order-2">
        <div className="h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px]">
          <ChatInterface
            title={sectionContent[selectedSection as keyof typeof sectionContent]?.title || "BRD Assistant"}
            subtitle={sectionContent[selectedSection as keyof typeof sectionContent]?.subtitle || "Discuss your business requirements"}
            initialMessage={sectionContent[selectedSection as keyof typeof sectionContent]?.initialMessage || "Hello! 👋 I'm your BRD Assistant."}
            placeholder={sectionContent[selectedSection as keyof typeof sectionContent]?.placeholder || "Type your message..."}
            onReviewed={handleSectionReviewed}
            externalMessages={chatMessages.brd}
            onMessagesChange={(messages) => setChatMessages("brd", messages)}
            disabled={uploadedFileBatches.length === 0}
            sectionContext={brdSections.find(s => s.title === selectedSection)?.content}
            selectedSectionTitle={selectedSection}
            selectedSectionNumber={brdSections.find(s => s.title === selectedSection)?.sectionNumber || null}
            onSectionChangeRequest={(sectionIdentifier) => {
              // Find section by number or title
              let targetSection = null;
              if (typeof sectionIdentifier === 'number') {
                targetSection = brdSections.find(s => s.sectionNumber === sectionIdentifier);
              } else {
                // Try to find by title (case-insensitive, partial match)
                targetSection = brdSections.find(s =>
                  s.title.toLowerCase().includes(sectionIdentifier.toLowerCase()) ||
                  sectionIdentifier.toLowerCase().includes(s.title.toLowerCase())
                );
              }
              if (targetSection) {
                setSelectedSection(targetSection.title);
              }
            }}
            onResponseReceived={handleResponseReceived}
            brdId={brdId}
            isRestoringChat={isRestoringSession}
          />
        </div>
      </div>

      <div className="lg:col-span-3 order-2 lg:order-3">
        <FileUploadSection onUploadSuccess={handleFileUploadSuccess} />
      </div>
    </div>
  </div>;
};