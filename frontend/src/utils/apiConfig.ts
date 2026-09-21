// src/utils/apiConfig.ts
// Centralized backend URL configuration supporting Vercel deployment environments

export const BACKEND_URL: string = (
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'http://localhost:8000'
).replace(/\/$/, '');
