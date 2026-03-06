import { MainLayout } from "@/components/layout/MainLayout";
import { JiraDashboard } from "@/components/dashboard/JiraDashboard";

const JiraPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <MainLayout currentView="jira">
        <JiraDashboard />
      </MainLayout>
    </div>
  );
};

export default JiraPage;
