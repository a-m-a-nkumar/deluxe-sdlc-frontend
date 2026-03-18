import { StatsCards } from "./StatsCards";
import { OrchestrationChat } from "../chat/OrchestrationChat";

export const ProjectOverview = () => {
  return (
    <div className="p-2 sm:p-4 md:p-6 lg:p-8 bg-white">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-4 lg:mb-8">
        <div className="xl:col-span-2">
          <div className="bg-card rounded-lg border border-border p-3 sm:p-4 md:p-6">
            <div className="mb-4">
              <h2 className="text-base font-bold">SDLC Orchestration Assistant</h2>
              <p className="text-xs text-muted-label">
                AI-powered assistant with access to your Confluence and Jira documentation
              </p>
            </div>

            <div className="h-60 sm:h-80 md:h-96">
              <OrchestrationChat />
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4 lg:mb-8">
        <h1 className="text-base font-bold mb-2 text-body-dark">Project Overview</h1>
      </div>

      <StatsCards />
    </div>
  );
};