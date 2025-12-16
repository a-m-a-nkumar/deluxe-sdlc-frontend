import { StatsCards } from "./StatsCards";
import { ChatInterface } from "../chat/ChatInterface";
import { useAppState } from "@/contexts/AppStateContext";

export const ProjectOverview = () => {
  const { chatMessages, setChatMessages } = useAppState();

  return (
    <div className="p-2 sm:p-4 md:p-6 lg:p-8" style={{ backgroundColor: '#fff' }}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-4 lg:mb-8">
        <div className="xl:col-span-2">
          <div className="bg-card rounded-lg border border-border p-3 sm:p-4 md:p-6">
            <div className="mb-4">
              <h2 className="text-base font-bold">SDLC Orchestration Assistant</h2>
              <p className="text-xs" style={{ color: '#727272', fontSize: '12px' }}>
                Your AI guide for software development lifecycle management
              </p>
            </div>
            
            <div className="h-60 sm:h-80 md:h-96">
              <ChatInterface
                title="SDLC Orchestration Assistant"
                subtitle="Your AI guide for software development lifecycle management"
                initialMessage="Hello! 👋 I'm your SDLC Orchestration Assistant. I'm here to help you navigate through your software development lifecycle workflow.

What would you like to work on today?"
                placeholder="Type your message about business requirements..."
                externalMessages={chatMessages.overview}
                onMessagesChange={(messages) => setChatMessages("overview", messages)}
                disableStreamForJira={true}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 lg:mb-8">
        <h1 className="text-base font-bold mb-2" style={{ color: '#3B3B3B' }}>Project Overview</h1>
      </div>
      
      <StatsCards />
    </div>
  );
};