import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

interface ModuleProtectedRouteProps {
  children: React.ReactNode;
  moduleId: string;
}

export const ModuleProtectedRoute = ({ children, moduleId }: ModuleProtectedRouteProps) => {
  const { isAuthenticated, isLoading, hasModuleAccess } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!hasModuleAccess(moduleId)) {
    return (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Access Denied</AlertDialogTitle>
            <AlertDialogDescription>
              You do not have permission to access this module. Please contact your
              administrator to request access through the appropriate Azure AD group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => navigate("/")}>
              Return to Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return <>{children}</>;
};
