import { OrchestrationChat } from "../chat/OrchestrationChat";

export const ProjectOverview = () => {
  return (
    <div className="p-2 sm:p-4 md:p-6 lg:p-8 h-full bg-white">
      <div className="bg-card rounded-lg border border-border p-3 sm:p-4 md:p-6 h-full">
        <div className="mb-4">
          <h2 className="text-base font-bold">SDLC Orchestration Assistant</h2>
          <p className="text-xs text-[#727272]">
            AI-powered assistant with access to your Confluence and Jira documentation
          </p>
        </div>

        <div className="h-[calc(100vh-220px)]">
          <OrchestrationChat />
        </div>
      </div>
    </div>
  );
};