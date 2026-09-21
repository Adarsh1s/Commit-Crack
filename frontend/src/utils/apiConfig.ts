// src/utils/apiConfig.ts
// Centralized backend URL configuration supporting Vercel deployment environments

const STORAGE_KEY = 'aqua_sentinel_backend_url';

export function getBackendUrl(): string {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.trim()) {
        return saved.trim().replace(/\/$/, '');
      }
    } catch {
      // localStorage may be restricted in some iframes/environments
    }
  }
  return (
    (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
    (import.meta.env.VITE_API_URL as string | undefined) ||
    'http://localhost:8000'
  ).replace(/\/$/, '');
}

export function setBackendUrl(url: string): void {
  if (typeof window !== 'undefined') {
    try {
      if (url.trim()) {
        localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/$/, ''));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      window.dispatchEvent(new Event('aqua_backend_url_changed'));
    } catch {
      // ignore storage error
    }
  }
}

export function isMixedContentUrl(url: string): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:' && url.startsWith('http://');
}

export const BACKEND_URL: string = getBackendUrl();
