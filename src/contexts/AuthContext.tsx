import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import msalInstance, { ensureMsalInitialized, loginWithAzureAD, getUserInfo, logout as azureLogout, getAccessToken, isAuthenticated as checkAzureAuth } from "@/services/authService";
import { fetchBackendUserInfo, GraphUnavailableError } from "@/services/authApi";
import { toast } from "sonner";

// Inactivity timeout — auto-logout after 5 minutes of no activity
const INACTIVITY_TIMEOUT_MS = 300_000;

// Kept only for the isBusinessUser convenience flag — the authoritative
// allowed-modules list now comes from the backend (which handles Azure AD
// groups-claim overage via Microsoft Graph).
const BUSINESS_GROUP_OID = "be88c38e-8a45-4026-ac85-f0f850b8cc03";

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
  isBusinessUser: boolean;
  /** True when the backend returned 503 from /api/user/info — Graph fallback
   *  is temporarily down for an overage user. Distinct from `user with empty
   *  allowedModules` which is the permanent AccessDenied state. */
  permissionsUnavailable: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissionsUnavailable, setPermissionsUnavailable] = useState(false);

  // Ask the backend who this user is (source of truth for RBAC).
  //
  // Three outcomes:
  //   1. 200 → user has SDLC groups (allowed_modules populated) → home
  //   2. 200 with allowed_modules=[] → user has no SDLC groups → AccessDenied
  //   3. 503 → Graph fallback failed (overage user, transient) → "service
  //      temporarily unavailable" page. NOT the permanent AccessDenied — these
  //      are different states and users deserve to be told which one they're
  //      in. `fetchBackendUserInfo` already retries 3× before surfacing 503.
  const buildUserFromBackend = async (
    msalUser: { id: string; email: string; name: string; groups: string[] },
    token: string,
  ): Promise<User> => {
    try {
      const backend = await fetchBackendUserInfo(token);
      setPermissionsUnavailable(false);
      return {
        id: msalUser.id,
        email: backend.email || msalUser.email,
        name: backend.name || msalUser.name,
        groups: backend.groups || [],
        allowedModules: backend.allowed_modules || [],
      };
    } catch (err) {
      if (err instanceof GraphUnavailableError) {
        console.warn("[AUTH] Graph fallback unavailable — surfacing transient state, not AccessDenied");
        setPermissionsUnavailable(true);
        return {
          ...msalUser,
          allowedModules: [],
        };
      }
      console.error("[AUTH] Failed to fetch user info from backend — denying access:", err);
      setPermissionsUnavailable(false);
      return {
        ...msalUser,
        allowedModules: [],
      };
    }
  };

  // Initialize auth — handle redirect response when Azure sends user back
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await ensureMsalInitialized();

        // CRITICAL: handle redirect response when Azure redirects back after login
        const redirectResult = await msalInstance.handleRedirectPromise();
        if (redirectResult) {
          const msalUser = getUserInfo();
          if (msalUser) {
            const token = redirectResult.idToken;
            setAccessToken(token);
            const hydrated = await buildUserFromBackend(msalUser, token);
            setUser(hydrated);
          }
          setIsLoading(false);
          return;
        }

        // Already logged in (token in localStorage from previous session)
        if (checkAzureAuth()) {
          const msalUser = getUserInfo();
          if (msalUser) {
            const token = await getAccessToken();
            if (token) {
              setAccessToken(token);
              const hydrated = await buildUserFromBackend(msalUser, token);
              setUser(hydrated);
            }
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
        const msalUser = getUserInfo();
        if (msalUser) {
          const token = response.accessToken;
          setAccessToken(token);
          const hydrated = await buildUserFromBackend(msalUser, token);
          setUser(hydrated);
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

  // ── Inactivity auto-logout ──
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Clear MSAL accounts locally without triggering Azure redirect
        const accounts = msalInstance.getAllAccounts();
        accounts.forEach((a) => msalInstance.setActiveAccount(null));
        localStorage.clear();

        setUser(null);
        setAccessToken(null);
        toast("Your session has ended", {
          description: "You were signed out after being inactive. Please log in again to continue.",
          duration: Infinity,
          icon: "🔒",
        });
      }, INACTIVITY_TIMEOUT_MS);
    };

    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "scroll", "mousedown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [user]);

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
        isBusinessUser: !!user?.groups.includes(BUSINESS_GROUP_OID),
        permissionsUnavailable,
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
