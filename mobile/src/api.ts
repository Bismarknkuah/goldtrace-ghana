import axios from "axios";

// Set EXPO_PUBLIC_API_URL in .env (use your machine's LAN IP for a device).
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
export const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, "");

export const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

export function setAuthToken(token: string | null) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}
