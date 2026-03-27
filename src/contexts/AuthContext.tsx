import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { loginWithAzureAD, getUserInfo, logout as azureLogout, getAccessToken, isAuthenticated as checkAzureAuth } from "@/services/authService";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  login: () => Promise<void>;
  devLogin: () => void;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── DEV BYPASS — remove once nonprod SSO is fully configured ──
  const devLogin = () => {
    const devUser: User = {
      id: "dev-bypass-T479888",
      email: "T479888@deluxe.com",
      name: "Dev User (T479888)",
    };
    const devToken = "dev-bypass-T479888";
    setUser(devUser);
    setAccessToken(devToken);
    sessionStorage.setItem(
      "dev-bypass-session",
      JSON.stringify({ user: devUser, token: devToken })
    );
  };
  // ──────────────────────────────────────────────────────────────

  // Check if user is already logged in on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // ── DEV BYPASS: check for persisted dev session ──
        const devSession = sessionStorage.getItem("dev-bypass-session");
        if (devSession) {
          const parsed = JSON.parse(devSession);
          setUser(parsed.user);
          setAccessToken(parsed.token);
          setIsLoading(false);
          return;
        }
        // ─────────────────────────────────────────────────

        if (checkAzureAuth()) {
          const userInfo = getUserInfo();
          if (userInfo) {
            setUser(userInfo);
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
          setUser(userInfo);
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
      sessionStorage.removeItem("dev-bypass-session");
      await azureLogout();
      setUser(null);
      setAccessToken(null);
    } catch (error) {
      console.error("Logout error:", error);
      // Clear local state even if Azure logout fails
      setUser(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        accessToken,
        login,
        devLogin,
        logout,
        isLoading,
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
