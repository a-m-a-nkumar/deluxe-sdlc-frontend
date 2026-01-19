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
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already logged in on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (checkAzureAuth()) {
          const userInfo = getUserInfo();
          if (userInfo) {
            setUser(userInfo);
            // Get access token
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


