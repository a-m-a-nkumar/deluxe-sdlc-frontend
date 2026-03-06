import { getAccessToken } from "./authService";
import { API_CONFIG } from "@/config/api";

/**
 * Make an authenticated API request with Azure AD token
 */
export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAccessToken();
  
  const headers = new Headers(options.headers);
  
  // Add Azure AD token to Authorization header
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    console.log("[API] Token included in request:", token.substring(0, 20) + "...");
  } else {
    console.warn("[API] No token available for request to:", url);
  }
  
  // Set Content-Type if not already set and body is not FormData
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If unauthorized, try to refresh token and retry once
  if (response.status === 401 && token) {
    // Token might be expired, try to get a fresh one
    const newToken = await getAccessToken();
    if (newToken && newToken !== token) {
      headers.set("Authorization", `Bearer ${newToken}`);
      return fetch(url, {
        ...options,
        headers,
      });
    }
  }

  return response;
}

/**
 * Make a GET request
 */
export async function apiGet(url: string, options: RequestInit = {}): Promise<Response> {
  return apiRequest(url, { ...options, method: "GET" });
}

/**
 * Make a POST request
 */
export async function apiPost(
  url: string,
  body?: any,
  options: RequestInit = {}
): Promise<Response> {
  const requestOptions: RequestInit = {
    ...options,
    method: "POST",
  };

  if (body instanceof FormData) {
    requestOptions.body = body;
  } else if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  return apiRequest(url, requestOptions);
}

/**
 * Make a PUT request
 */
export async function apiPut(
  url: string,
  body?: any,
  options: RequestInit = {}
): Promise<Response> {
  const requestOptions: RequestInit = {
    ...options,
    method: "PUT",
  };

  if (body instanceof FormData) {
    requestOptions.body = body;
  } else if (body) {
    requestOptions.body = JSON.stringify(body);
  }

  return apiRequest(url, requestOptions);
}

/**
 * Make a DELETE request
 */
export async function apiDelete(url: string, options: RequestInit = {}): Promise<Response> {
  return apiRequest(url, { ...options, method: "DELETE" });
}

