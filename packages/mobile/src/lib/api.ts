import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { getServerUrl, getAccessToken, setAccessToken, clearAll } from './storage';

let apiInstance: AxiosInstance | null = null;

export async function getApi(): Promise<AxiosInstance> {
  if (apiInstance) return apiInstance;

  const serverUrl = await getServerUrl();
  if (!serverUrl) {
    throw new Error('Server-URL nicht konfiguriert');
  }

  apiInstance = axios.create({
    baseURL: `${serverUrl}/api/v1`,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor: Token hinzufügen
  apiInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
  );

  // Response interceptor: 401 → Logout
  apiInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      if (error.response?.status === 401) {
        await clearAll();
        apiInstance = null;
      }
      return Promise.reject(error);
    },
  );

  return apiInstance;
}

export function resetApi(): void {
  apiInstance = null;
}

export async function validateServerUrl(url: string): Promise<boolean> {
  try {
    const cleanUrl = url.replace(/\/+$/, '');
    const response = await axios.get(`${cleanUrl}/health`, { timeout: 5000 });
    return response.data?.status === 'ok';
  } catch {
    return false;
  }
}
