import "server-only";

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ApiError } from "./types";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

if (!BACKEND_BASE_URL) {
  console.error("[BFF] NEXT_PUBLIC_API_URL is not set! Backend requests will fail.");
}

function unauthorizedResponse(): NextResponse<ApiError> {
  return NextResponse.json(
    { code: "UNAUTHORIZED", error: "Session expired" },
    { status: 401 }
  );
}

/**
 * Generic helper for JSON proxying (non-multipart).
 */
// Helper type to avoid BodyInit conflict
type ProxyJsonBody = unknown;

export async function proxyJson<RequestBody = ProxyJsonBody, ResponseBody = unknown>(
  path: string,
  init?: { 
    method?: string; 
    headers?: HeadersInit; 
    body?: RequestBody | null; 
    signal?: AbortSignal;
  }
): Promise<NextResponse<ResponseBody | ApiError>> {
  const supabase = createServerSupabaseClient();
  
  // Try getSession first - Supabase SSR should auto-refresh if needed
  let session = null;
  try {
    // getSession() will automatically refresh if the refresh token is available
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session;
    
    // If no session, try getUser() which might work even without a valid session
    // This can help if the refresh token is still valid but session expired
    if (!session) {
      console.warn("[BFF] No session found, checking if user exists...");
      try {
        const userResult = await supabase.auth.getUser();
        if (userResult.data?.user) {
          // User exists, try to get session again (might trigger refresh)
          const retrySessionResult = await supabase.auth.getSession();
          session = retrySessionResult.data?.session;
          
          if (session) {
            console.log("[BFF] Session obtained after getUser()");
          } else {
            console.warn("[BFF] User exists but no session available. Refresh token may be expired.");
          }
        } else {
          console.warn("[BFF] No user found. User is not authenticated.");
        }
      } catch (getUserError) {
        console.error("[BFF] Error getting user:", getUserError);
      }
    } else {
      // Check if session is about to expire (within 5 minutes)
      const expiresAt = session.expires_at;
      if (expiresAt) {
        const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
        if (expiresIn < 300 && expiresIn > 0) { // Less than 5 minutes but not expired yet
          console.log("[BFF] Session expiring soon, attempting refresh...");
          // getSession() should auto-refresh, but we can try explicit refresh
          try {
            const refreshResult = await supabase.auth.refreshSession();
            if (refreshResult.data?.session) {
              session = refreshResult.data.session;
              console.log("[BFF] Session refreshed proactively");
            }
          } catch (refreshError) {
            // If refresh fails, use existing session (it's still valid)
            console.warn("[BFF] Proactive refresh failed, using existing session:", refreshError);
          }
        }
      }
    }
  } catch (error) {
    console.error("[BFF] Error getting session:", error);
  }

  if (!session) {
    console.error("[BFF] No session available for request to:", path);
    return unauthorizedResponse();
  }
  
  console.log("[BFF] Session found, user ID:", session.user.id);

  const url = `${BACKEND_BASE_URL}${path}`;
  const method = init?.method ?? "GET";

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("Accept", "application/json");
  
  // Handle body - stringify if it exists and is not null
  let bodyString: string | undefined = undefined;
  if (init?.body != null) {
    headers.set("Content-Type", "application/json");
    // Type assertion needed because TypeScript infers body as BodyInit | RequestBody
    bodyString = JSON.stringify(init.body as any);
  }

  const fetchInit: RequestInit = {
    method,
    headers,
    body: bodyString,
  };

  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const resp = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    const text = await resp.text();
    
    // Handle empty responses
    if (!text) {
      if (!resp.ok) {
        return NextResponse.json(
          { code: `HTTP_${resp.status}`, error: resp.statusText || "Request failed" },
          { status: resp.status }
        );
      }
      return NextResponse.json(null as ResponseBody, { status: resp.status });
    }
    
    let json;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      // If response isn't JSON, return error with the raw text
      console.error("Failed to parse JSON response. Raw text:", text);
      return NextResponse.json(
        { 
          code: "INVALID_RESPONSE", 
          error: `Backend returned invalid JSON: ${text.substring(0, 200)}` 
        },
        { status: 500 }
      );
    }

    // Handle 502 Bad Gateway (backend not responding)
    if (resp.status === 502) {
      console.error("[BFF] Backend returned 502 - Application failed to respond");
      console.error("[BFF] Backend URL:", url);
      console.error("[BFF] Check if Flask backend is running and accessible at:", BACKEND_BASE_URL);
      
      return NextResponse.json(
        {
          code: "BACKEND_UNAVAILABLE",
          error: `Backend server is not responding. Please check:
1. Is your Flask backend running?
2. Is NEXT_PUBLIC_API_URL set correctly? (Current: ${BACKEND_BASE_URL || "NOT SET"})
3. Can you reach the backend URL directly?`,
        },
        { status: 502 }
      );
    }

    // If backend returned an error, preserve it
    if (!resp.ok && json) {
      console.error("Backend error response:", json);
    }

    return NextResponse.json(json, { status: resp.status });
  } catch (fetchError) {
    // Network errors or fetch failures
    console.error("BFF fetch error:", fetchError);
    
    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      return NextResponse.json(
        {
          code: "TIMEOUT",
          error: "Backend request timed out after 30 seconds",
        },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      {
        code: "FETCH_ERROR",
        error: fetchError instanceof Error ? fetchError.message : "Failed to reach backend",
      },
      { status: 500 }
    );
  }
}

/**
 * Helper for multipart upload proxying.
 */
export async function proxyMultipart<ResponseBody = unknown>(
  path: string,
  formData: FormData,
  method: "POST" | "PUT" = "POST"
): Promise<NextResponse<ResponseBody | ApiError>> {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return unauthorizedResponse();
  }

  const url = `${BACKEND_BASE_URL}${path}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${session.access_token}`);
  // Let the runtime set multipart boundary; do not override Content-Type.

  try {
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for uploads

    const resp = await fetch(url, {
      method,
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const text = await resp.text();
    
    // Log response for debugging (especially for upload endpoint)
    if (path.includes("upload")) {
      console.log("[BFF proxyMultipart] Upload response status:", resp.status);
      console.log("[BFF proxyMultipart] Upload response text length:", text.length);
      try {
        const parsed = JSON.parse(text);
        console.log("[BFF proxyMultipart] Upload response JSON:", parsed);
        if (parsed.post_questions) {
          console.log("[BFF proxyMultipart] Post questions count:", parsed.post_questions.length);
        } else {
          console.warn("[BFF proxyMultipart] No post_questions in response!");
        }
      } catch (e) {
        console.error("[BFF proxyMultipart] Failed to parse upload response:", e);
      }
    }
    
    // Handle empty responses
    if (!text) {
      if (!resp.ok) {
        return NextResponse.json(
          { code: `HTTP_${resp.status}`, error: resp.statusText || "Request failed" },
          { status: resp.status }
        );
      }
      return NextResponse.json(null as ResponseBody, { status: resp.status });
    }
    
    // Handle 502 Bad Gateway (backend not responding)
    if (resp.status === 502) {
      console.error("[BFF proxyMultipart] Backend returned 502 - Application failed to respond");
      console.error("[BFF proxyMultipart] Backend URL:", url);
      console.error("[BFF proxyMultipart] Check if Flask backend is running and accessible at:", BACKEND_BASE_URL);
      
      return NextResponse.json(
        {
          code: "BACKEND_UNAVAILABLE",
          error: `Backend server is not responding. Please check:
1. Is your Flask backend running?
2. Is NEXT_PUBLIC_API_URL set correctly? (Current: ${BACKEND_BASE_URL || "NOT SET"})
3. Can you reach the backend URL directly?`,
        },
        { status: 502 }
      );
    }

    // Check if response is HTML (404/500 error page) before trying to parse JSON
    if (text.includes("<!doctype html>") || text.includes("<html") || text.includes("<title>")) {
      console.error("Backend returned HTML instead of JSON");
      console.error("Response status:", resp.status);
      console.error("Response URL:", url);
      console.error("Response path:", path);
      
      if (resp.status === 404) {
        return NextResponse.json(
          {
            code: "NOT_FOUND",
            error: `Flask backend route not found: ${path}. The endpoint doesn't exist on your Flask server. Check your Flask routes.`,
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        {
          code: "HTML_ERROR_RESPONSE",
          error: `Backend returned HTML error page (status ${resp.status}) instead of JSON. This usually means the route doesn't exist or there's a server configuration issue.`,
        },
        { status: resp.status || 500 }
      );
    }
    
    let json;
    try {
      json = JSON.parse(text);
    } catch (parseError) {
      // If response isn't JSON, return error with the raw text
      console.error("Failed to parse JSON response. Raw text:", text.substring(0, 500));
      return NextResponse.json(
        { 
          code: "INVALID_RESPONSE", 
          error: `Backend returned invalid JSON: ${text.substring(0, 200)}` 
        },
        { status: 500 }
      );
    }

    // If backend returned an error, preserve it
    if (!resp.ok) {
      console.error("Backend error response:", json);
      console.error("Response status:", resp.status);
      console.error("Response URL:", url);
      
      // Include the full error details
      if (json) {
        return NextResponse.json(json, { status: resp.status });
      }
      
      // If no JSON, return generic error
      return NextResponse.json(
        {
          code: `HTTP_${resp.status}`,
          error: resp.statusText || "Request failed",
        },
        { status: resp.status }
      );
    }

    return NextResponse.json(json, { status: resp.status });
  } catch (fetchError) {
    console.error("BFF multipart fetch error:", fetchError);
    
    if (fetchError instanceof Error && fetchError.name === "AbortError") {
      return NextResponse.json(
        {
          code: "TIMEOUT",
          error: "Backend request timed out after 60 seconds",
        },
        { status: 504 }
      );
    }
    
    return NextResponse.json(
      {
        code: "FETCH_ERROR",
        error: fetchError instanceof Error ? fetchError.message : "Failed to reach backend",
      },
      { status: 500 }
    );
  }
}

