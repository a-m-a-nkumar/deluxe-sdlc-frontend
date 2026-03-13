import { PublicClientApplication, AccountInfo, AuthenticationResult } from "@azure/msal-browser";

// Azure AD Configuration
const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || "";
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || "";

if (!AZURE_CLIENT_ID || !AZURE_TENANT_ID) {
  console.warn("[AUTH] VITE_AZURE_CLIENT_ID or VITE_AZURE_TENANT_ID not set in environment variables");
}

// MSAL Configuration (no NextAuth — this app uses MSAL only).
// In Azure Portal → App registration → Authentication → add SPA redirect URI:
//   https://deluxe.siriusai.com  (must match window.location.origin in production)
// Do NOT use /api/auth/callback/azure-ad — that is for NextAuth (Next.js), not this app.
const msalConfig = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage", // This configures where your cache will be stored
    storeAuthStateInCookie: false, // Set this to "true" if you are having issues on IE11 or Edge
  },
};

// Create MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

// Initialize MSAL (will be called on first use)
let msalInitialized = false;

async function ensureMsalInitialized() {
  if (!msalInitialized) {
    await msalInstance.initialize();
    msalInitialized = true;
  }
}

// Login request configuration
// Use User.Read for user info (this gives us an access token for Microsoft Graph)
// For our API, we'll accept Microsoft Graph tokens (we verify issuer, not audience)
const loginRequest = {
  scopes: ["User.Read"],
};

// Global auth failure callback — invoked when tokens cannot be refreshed at all
type AuthFailureCallback = () => void;
let _onAuthFailure: AuthFailureCallback | null = null;

export function setOnAuthFailure(callback: AuthFailureCallback | null) {
  _onAuthFailure = callback;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
}

/**
 * Login with Azure AD
 */
export async function loginWithAzureAD(): Promise<AuthenticationResult | null> {
  try {
    await ensureMsalInitialized();
    const response = await msalInstance.loginPopup(loginRequest);
    return response;
  } catch (error) {
    console.error("Azure AD login error:", error);
    throw error;
  }
}

/**
 * Get access token for API calls.
 * @param forceRefresh - If true, bypasses MSAL cache and fetches a fresh token from Azure AD.
 *                       Use this when retrying after a 401 response.
 */
export async function getAccessToken(forceRefresh: boolean = false): Promise<string | null> {
  try {
    await ensureMsalInitialized();
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      return null;
    }

    const account = accounts[0];

    const tokenRequest = {
      scopes: ["User.Read"],
      account: account,
      forceRefresh: forceRefresh,
    };

    const response = await msalInstance.acquireTokenSilent(tokenRequest);
    // Use ID Token instead of Access Token because we are the same app
    // and Access Token for User.Read is for Graph API (audience 00000003...) which we can't verify
    return response.idToken;
  } catch (error) {
    console.error("Error acquiring token:", error);
    // If error is about scope, clear cache and try again
    if (error instanceof Error && error.message.includes("scope")) {
      console.log("[AUTH] Scope error detected, clearing cache and retrying...");
      try {
        msalInstance.clearCache();
        await ensureMsalInitialized();
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
          const account = accounts[0];
          const response = await msalInstance.acquireTokenSilent({
            scopes: ["User.Read"],
            account: account,
          });
          return response.idToken;
        }
      } catch (retryError) {
        console.error("Error after cache clear:", retryError);
      }
    }

    // Try interactive login if silent fails
    try {
      await ensureMsalInitialized();
      const response = await msalInstance.acquireTokenPopup({
        scopes: ["User.Read"],
      });
      return response.idToken;
    } catch (popupError) {
      console.error("Error acquiring token via popup:", popupError);
      // Both silent and interactive failed — auth is unrecoverable
      if (_onAuthFailure) _onAuthFailure();
      return null;
    }
  }
}

/**
 * Get user info from current account
 */
export function getUserInfo(): UserInfo | null {
  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    return {
      id: account.homeAccountId || account.localAccountId || "",
      email: account.username || "",
      name: account.name || account.username || "",
    };
  } catch (error) {
    console.error("Error getting user info:", error);
    return null;
  }
}

/**
 * Get current account
 */
export function getCurrentAccount(): AccountInfo | null {
  try {
    const accounts = msalInstance.getAllAccounts();
    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error("Error getting current account:", error);
    return null;
  }
}

/**
 * Logout from Azure AD
 */
export async function logout(): Promise<void> {
  try {
    await ensureMsalInitialized();
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      await msalInstance.logoutPopup({
        account: accounts[0],
      });
    }
  } catch (error) {
    console.error("Error during logout:", error);
    // Clear local state even if logout fails
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  try {
    const accounts = msalInstance.getAllAccounts();
    return accounts.length > 0;
  } catch (error) {
    console.error("Error checking authentication:", error);
    return false;
  }
}

export default msalInstance;

