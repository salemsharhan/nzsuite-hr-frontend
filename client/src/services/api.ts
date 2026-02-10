import axios from 'axios';
import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
}

// Create axios instance for Supabase REST API
export const api = axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation' // Return the created/updated record
  }
});

// Helper for service role requests (admin only)
// Note: Both apikey and Authorization should use the service role key to bypass RLS
export const adminApi = axios.create({
  baseURL: `${SUPABASE_URL}/rest/v1`,
  headers: {
    'apikey': SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY, // Use service key if available
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }
});

// Helper function to check if a token is a valid JWT
const isValidJWT = (token: string): boolean => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
};

// Cache for Supabase session to avoid repeated async calls
let cachedSession: { access_token: string; expires_at: number } | null = null;
let sessionCacheTime = 0;
const SESSION_CACHE_DURATION = 60000; // 1 minute

// Add request interceptor to include access token for RLS
api.interceptors.request.use(
  config => {
    // First, check cached session (synchronous)
    const now = Date.now();
    if (cachedSession && now < sessionCacheTime) {
      if (isValidJWT(cachedSession.access_token)) {
        config.headers.Authorization = `Bearer ${cachedSession.access_token}`;
        return config;
      }
    }
    
    // Check sessionStorage/localStorage synchronously
    const accessToken = sessionStorage.getItem('access_token') || localStorage.getItem('access_token');
    if (accessToken && isValidJWT(accessToken) && accessToken !== SUPABASE_ANON_KEY) {
      config.headers.Authorization = `Bearer ${accessToken}`;
      // Cache it
      cachedSession = { access_token: accessToken, expires_at: 0 };
      sessionCacheTime = now + SESSION_CACHE_DURATION;
      return config;
    }
    
    // If no valid token found, use default anon key (already set in default headers)
    // Don't try async Supabase session here to avoid breaking synchronous requests
    
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Periodically refresh Supabase session in background
// This proactively refreshes tokens before they expire
setInterval(async () => {
  try {
    // Check if we have a refresh token
    const refreshToken = sessionStorage.getItem('refresh_token') || localStorage.getItem('refresh_token');
    
    if (refreshToken) {
      // Use refreshSession to get a new access token
      const { data: { session }, error } = await supabase.auth.refreshSession();
      
      if (!error && session?.access_token && isValidJWT(session.access_token)) {
        cachedSession = {
          access_token: session.access_token,
          expires_at: session.expires_at || 0
        };
        sessionCacheTime = Date.now() + SESSION_CACHE_DURATION;
        
        // Update stored tokens
        sessionStorage.setItem('access_token', session.access_token);
        if (session.refresh_token) {
          sessionStorage.setItem('refresh_token', session.refresh_token);
        }
      }
    } else {
      // Fallback to getSession if no refresh token
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token && isValidJWT(session.access_token)) {
        cachedSession = {
          access_token: session.access_token,
          expires_at: session.expires_at || 0
        };
        sessionCacheTime = Date.now() + SESSION_CACHE_DURATION;
      }
    }
  } catch (error) {
    // Silently fail - token refresh will happen on next request if needed
  }
}, 300000); // Check every 5 minutes (tokens typically expire after 1 hour)

// Add response interceptor for error handling and token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // Check if error is JWT expired
    if (error.response?.status === 401 || 
        (error.response?.data?.code === 'PGRST303' && error.response?.data?.message?.includes('JWT expired'))) {
      
      // Avoid infinite retry loop
      if (originalRequest._retry) {
        // If we've already tried to refresh, redirect to login
        console.error('Token refresh failed, redirecting to login');
        window.location.href = '/login';
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        // Refresh the session using Supabase
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !session) {
          // Refresh failed, clear cache and redirect to login
          cachedSession = null;
          sessionStorage.removeItem('access_token');
          localStorage.removeItem('access_token');
          window.location.href = '/login';
          return Promise.reject(refreshError || new Error('Session refresh failed'));
        }

        // Update cached session
        cachedSession = {
          access_token: session.access_token,
          expires_at: session.expires_at || 0
        };
        sessionCacheTime = Date.now() + SESSION_CACHE_DURATION;

        // Store token in storage
        sessionStorage.setItem('access_token', session.access_token);
        if (session.refresh_token) {
          sessionStorage.setItem('refresh_token', session.refresh_token);
        }

        // Update the authorization header with new token
        originalRequest.headers.Authorization = `Bearer ${session.access_token}`;

        // Retry the original request with new token
        return api(originalRequest);
      } catch (refreshErr) {
        // Refresh failed, clear everything and redirect
        cachedSession = null;
        sessionStorage.removeItem('access_token');
        localStorage.removeItem('access_token');
        console.error('Error refreshing session:', refreshErr);
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      }
    }

    // Log detailed error information for other errors
    if (error.response) {
      // Skip logging for 404 (Not Found) which often means missing table or record
      if (error.response.status !== 404) {
        console.error('API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            data: error.config?.data
          }
        });
      }
    } else if (error.request) {
      console.error('API No Response:', error.request);
    } else {
      console.error('API Error Message:', error.message);
    }
    return Promise.reject(error);
  }
);

// Add response interceptor for adminApi to handle JWT expiration
// Note: adminApi uses service key, but if it falls back to anon key, it may need refresh
adminApi.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // Only handle JWT expiration if we're not using service key
    // Service key should never expire, but anon key might
    if (!SUPABASE_SERVICE_KEY && 
        (error.response?.status === 401 || 
         (error.response?.data?.code === 'PGRST303' && error.response?.data?.message?.includes('JWT expired')))) {
      
      if (originalRequest._retry) {
        console.error('Token refresh failed for adminApi');
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !session) {
          return Promise.reject(refreshError || new Error('Session refresh failed'));
        }

        // Update authorization header
        originalRequest.headers.Authorization = `Bearer ${session.access_token}`;
        originalRequest.headers.apikey = SUPABASE_ANON_KEY;

        return adminApi(originalRequest);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    // Log other errors
    if (error.response && error.response.status !== 404) {
      console.error('AdminAPI Error Response:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    return Promise.reject(error);
  }
);
