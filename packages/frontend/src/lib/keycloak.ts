import Keycloak from 'keycloak-js';

// Singleton — one instance per browser tab
let keycloakInstance: Keycloak | null = null;

export function getKeycloak(): Keycloak {
  if (!keycloakInstance) {
    keycloakInstance = new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL ?? '/auth',
      realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM ?? 'irm',
      clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID ?? 'irm-frontend',
    });
  }
  return keycloakInstance;
}
