import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { loginWithAzureAD, getUserInfo, logout as azureLogout, getAccessToken, isAuthenticated as checkAzureAuth } from "@/services/authService";

// ── Azure AD Group-Based RBAC ──
const BUSINESS_GROUP_OID = "be88c38e-8a45-4026-ac85-f0f850b8cc03";
const TECH_GROUP_OID = "670e52fc-59cc-4a13-b89c-c91367c7060c";

const GROUP_MODULE_MAP: Record<string, string[]> = {
  [BUSINESS_GROUP_OID]: ["brd", "confluence", "jira"],
  [TECH_GROUP_OID]: ["design", "pair-programming", "testing"],
};

function computeAllowedModules(groups: string[]): string[] {
  const modules = new Set<string>();
  groups.forEach((g) => (GROUP_MODULE_MAP[g] || []).forEach((m) => modules.add(m)));
  return Array.from(modules);
}

interface User {
  id: string;
  email: string;
  name: string;
  groups: string[];
  allowedModules: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  hasModuleAccess: (moduleId: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const buildUser = (userInfo: { id: string; email: string; name: string; groups: string[] }): User => {
    const allowed = computeAllowedModules(userInfo.groups);
    return { ...userInfo, allowedModules: allowed };
  };

  // Check if user is already logged in on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (checkAzureAuth()) {
          const userInfo = getUserInfo();
          if (userInfo) {
            setUser(buildUser(userInfo));
            const token = await getAccessToken();
            setAccessToken(token);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async () => {
    try {
      setIsLoading(true);
      const response = await loginWithAzureAD();
      if (response) {
        const userInfo = getUserInfo();
        if (userInfo) {
          setUser(buildUser(userInfo));
          setAccessToken(response.accessToken);
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await azureLogout();
      setUser(null);
      setAccessToken(null);
    } catch (error) {
      console.error("Logout error:", error);
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const hasModuleAccess = useCallback(
    (moduleId: string): boolean => {
      if (!user) return false;
      return user.allowedModules.includes(moduleId);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        accessToken,
        login,
        logout,
        isLoading,
        hasModuleAccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
