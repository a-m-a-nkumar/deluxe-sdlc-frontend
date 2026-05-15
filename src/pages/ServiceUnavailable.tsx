import { Clock, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Rendered when /api/user/info returned 503 — Microsoft Graph fallback for
 * this user (overage, i.e. >200 Azure AD groups) was unavailable. This is
 * NOT the AccessDenied page — that one is for "you don't have access". This
 * one means "we couldn't check your access just now; try again". Different
 * page so users see honest signal about which one applies to them.
 */
const ServiceUnavailable = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-xl w-full text-center space-y-8">
        <div className="mx-auto w-24 h-24 rounded-full bg-amber-500 flex items-center justify-center">
          <Clock className="w-12 h-12 text-white" strokeWidth={1.5} />
        </div>

        <h1 className="text-3xl font-bold text-gray-900">
          Permission Check Unavailable
        </h1>

        <p className="text-lg text-gray-700 leading-relaxed px-4">
          We couldn't verify your <span className="font-semibold">Velox</span> permissions
          just now. This is usually temporary — please refresh the page in a moment.
        </p>

        <Button
          className="bg-primary text-white hover:bg-primary/90 px-8 py-3 text-base font-medium gap-2.5"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-5 h-5" />
          Refresh
        </Button>

        <div className="pt-4 space-y-3">
          {user?.email && (
            <p className="text-sm text-gray-400">
              Signed in as <span className="font-medium text-gray-600">{user.email}</span>
            </p>
          )}
          <button
            onClick={() => logout()}
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceUnavailable;
