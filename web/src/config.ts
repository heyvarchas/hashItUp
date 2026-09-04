/**
 * Centralized API configuration for production and local development.
 * Reads from Vite environment variable `VITE_API_BASE_URL`.
 * Defaults to 'https://sthira.onrender.com' or 'http://localhost:8000' in development if unset.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://sthira.onrender.com' : 'http://localhost:8000');
