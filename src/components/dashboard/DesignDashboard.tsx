import { ChatInterface } from "../chat/ChatInterface";
import { FileUploadSection } from "../files/FileUploadSection";
import { useAppState } from "@/contexts/AppStateContext";

export const DesignDashboard = () => {
  const { chatMessages, setChatMessages } = useAppState();
  return (
    <div className="p-2 sm:p-4 md:p-6 lg:p-8" style={{ backgroundColor: '#fff' }}>
      <div className="mb-4 lg:mb-8">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">Design Assistant</h1>
        <p className="text-muted-foreground text-sm">Technical architecture planning and system design</p>
      </div>
      
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <div className="xl:col-span-1 order-2 xl:order-1">
          <div className="h-60 sm:h-80 md:h-[500px] xl:h-[600px]">
            <ChatInterface
              title="Design Assistant"
              subtitle="Technical architecture and system design guidance"
              initialMessage="Hello! 👋 I'm your Design Assistant. I can help you with technical architecture planning, system design, and creating scalable solutions.

What design challenge would you like to tackle?"
              placeholder="Ask about architecture, design patterns, or system planning..."
              externalMessages={chatMessages.design}
              onMessagesChange={(messages) => setChatMessages("design", messages)}
            />
          </div>
        </div>
        
        <div className="xl:col-span-1 order-1 xl:order-2">
          <div className="h-auto xl:h-full">
            <FileUploadSection />
          </div>
        </div>
      </div>
    </div>
  );
};