import axios from 'axios';
import { getKeycloak } from './keycloak';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach current Keycloak Bearer token before every request
api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config;

  const kc = getKeycloak();
  if (kc.authenticated) {
    // Proactively refresh if token expires within 30 s
    await kc.updateToken(30).catch(() => {
      kc.login();
    });
    if (kc.token) {
      config.headers.Authorization = `Bearer ${kc.token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      // Token was rejected — force re-login via Keycloak
      getKeycloak().login();
    }
    return Promise.reject(err);
  },
);
