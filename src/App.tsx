import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppStateProvider } from "./contexts/AppStateContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ModuleProtectedRoute } from "./components/auth/ModuleProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BRDAssistant from "./pages/BRDAssistant";
import AnalystAgent from "./pages/AnalystAgent";
import ConfluencePage from "./pages/ConfluencePage";
import JiraPage from "./pages/JiraPage";
import JiraGenerationPage from "./pages/JiraGenerationPage";
import TestScenarioPage from "./pages/TestScenarioPage";
import DesignAssistant from "./pages/DesignAssistant";
import PairProgramming from "./pages/PairProgramming";
import TestingPage from "./pages/TestingPage";
import NotFound from "./pages/NotFound";
const queryClient = new QueryClient();

// Sub-path prefix: reads VITE_BASE_PATH env var (e.g. "/sdlc/"), strips trailing slash for React Router
const basePath: string = import.meta.env.VITE_BASE_PATH
  ? String(import.meta.env.VITE_BASE_PATH).replace(/\/$/, '')
  : '/';

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppStateProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter basename={basePath}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                {/* Business group modules */}
                <Route
                  path="/brd-assistant"
                  element={
                    <ModuleProtectedRoute moduleId="brd">
                      <BRDAssistant />
                    </ModuleProtectedRoute>
                  }
                />
                <Route
                  path="/analyst-agent"
                  element={
                    <ModuleProtectedRoute moduleId="brd">
                      <AnalystAgent />
                    </ModuleProtectedRoute>
                  }
                />
                <Route
                  path="/confluence"
                  element={
                    <ModuleProtectedRoute moduleId="confluence">
                      <ConfluencePage />
                    </ModuleProtectedRoute>
                  }
                />
                <Route
                  path="/jira"
                  element={
                    <ModuleProtectedRoute moduleId="jira">
                      <JiraPage />
                    </ModuleProtectedRoute>
                  }
                />
                <Route
                  path="/jira-generation/:confluencePageId"
                  element={
                    <ModuleProtectedRoute moduleId="jira">
                      <JiraGenerationPage />
                    </ModuleProtectedRoute>
                  }
                />
                {/* Tech group modules */}
                <Route
                  path="/design-assistant"
                  element={
                    <ModuleProtectedRoute moduleId="design">
                      <DesignAssistant />
                    </ModuleProtectedRoute>
                  }
                />
                <Route
                  path="/pair-programming"
                  element={
                    <ModuleProtectedRoute moduleId="pair-programming">
                      <PairProgramming />
                    </ModuleProtectedRoute>
                  }
                />
                <Route
                  path="/test-generation/:confluencePageId"
                  element={
                    <ModuleProtectedRoute moduleId="testing">
                      <TestScenarioPage />
                    </ModuleProtectedRoute>
                  }
                />
                <Route
                  path="/testing"
                  element={
                    <ModuleProtectedRoute moduleId="testing">
                      <TestingPage />
                    </ModuleProtectedRoute>
                  }
                />
                <Route
                  path="/test-generation/:confluencePageId"
                  element={
                    <ProtectedRoute>
                      <TestScenarioPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/testing"
                  element={
                    <ProtectedRoute>
                      <TestingPage />
                    </ProtectedRoute>
                  }
                />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AppStateProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
