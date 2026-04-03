import {
  makeRedirectUri,
  useAuthRequest,
  exchangeCodeAsync,
  revokeAsync,
  refreshAsync,
  ResponseType,
  DiscoveryDocument,
} from 'expo-auth-session';
import { getServerUrl } from '../lib/storage';

export const KEYCLOAK_CLIENT_ID = 'irm-mobile';
export const KEYCLOAK_REALM = 'irm';

export async function getKeycloakDiscovery(): Promise<DiscoveryDocument | null> {
  const serverUrl = await getServerUrl();
  if (!serverUrl) return null;

  // Keycloak-URL aus Server-URL ableiten (gleicher Host, Port 8080)
  // Oder direkt aus dem Health-Endpoint lesen
  const baseUrl = new URL(serverUrl);
  const keycloakUrl = `${baseUrl.protocol}//${baseUrl.hostname}:8080`;

  return {
    authorizationEndpoint: `${keycloakUrl}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/auth`,
    tokenEndpoint: `${keycloakUrl}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`,
    revocationEndpoint: `${keycloakUrl}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/revoke`,
    userInfoEndpoint: `${keycloakUrl}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
    endSessionEndpoint: `${keycloakUrl}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`,
  };
}

export function getRedirectUri(): string {
  return makeRedirectUri({
    scheme: 'irm',
    path: 'auth/callback',
  });
}

export { exchangeCodeAsync, revokeAsync, refreshAsync, ResponseType, useAuthRequest };
