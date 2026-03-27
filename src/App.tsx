import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppStateProvider } from "./contexts/AppStateContext";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import BRDAssistant from "./pages/BRDAssistant";
import AnalystAgent from "./pages/AnalystAgent";
import ConfluencePage from "./pages/ConfluencePage";
import JiraPage from "./pages/JiraPage";
import JiraGenerationPage from "./pages/JiraGenerationPage";
import DesignAssistant from "./pages/DesignAssistant";
import PairProgramming from "./pages/PairProgramming";
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
                <Route
                  path="/brd-assistant"
                  element={
                    <ProtectedRoute>
                      <BRDAssistant />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/analyst-agent"
                  element={
                    <ProtectedRoute>
                      <AnalystAgent />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/confluence"
                  element={
                    <ProtectedRoute>
                      <ConfluencePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/jira"
                  element={
                    <ProtectedRoute>
                      <JiraPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/jira-generation/:confluencePageId"
                  element={
                    <ProtectedRoute>
                      <JiraGenerationPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/design-assistant"
                  element={
                    <ProtectedRoute>
                      <DesignAssistant />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pair-programming"
                  element={
                    <ProtectedRoute>
                      <PairProgramming />
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
