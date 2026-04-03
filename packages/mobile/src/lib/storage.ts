import * as SecureStore from 'expo-secure-store';

const KEYS = {
  SERVER_URL: 'irm_server_url',
  ACCESS_TOKEN: 'irm_access_token',
  REFRESH_TOKEN: 'irm_refresh_token',
  STAFF_ID: 'irm_staff_id',
} as const;

export async function getServerUrl(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.SERVER_URL);
}

export async function setServerUrl(url: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.SERVER_URL, url);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
}

export async function getStaffId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.STAFF_ID);
}

export async function setStaffId(id: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.STAFF_ID, id);
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
    SecureStore.deleteItemAsync(KEYS.STAFF_ID),
  ]);
}

export async function clearAllIncludingServer(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.SERVER_URL),
    SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
    SecureStore.deleteItemAsync(KEYS.STAFF_ID),
  ]);
}
