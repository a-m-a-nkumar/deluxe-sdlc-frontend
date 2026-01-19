import { PublicClientApplication, AccountInfo, AuthenticationResult } from "@azure/msal-browser";

// Azure AD Configuration
const AZURE_CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || "10eda5db-4715-4e7b-bcd9-32dba3533084";
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID || "0575746d-c254-4eea-bfc6-10d0979d1e90";

// MSAL Configuration
const msalConfig = {
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage", // This configures where your cache will be stored
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
 * Get access token for API calls
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    await ensureMsalInitialized();
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      return null;
    }

    const account = accounts[0];
    
    // Use only User.Read scope (no .default scope)
    const tokenRequest = {
      scopes: ["User.Read"],
      account: account,
    };
    
    const response = await msalInstance.acquireTokenSilent(tokenRequest);
    return response.accessToken;
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
          return response.accessToken;
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
      return response.accessToken;
    } catch (popupError) {
      console.error("Error acquiring token via popup:", popupError);
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

