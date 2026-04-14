'use client';

import { useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { getKeycloak } from '@/lib/keycloak';

/**
 * Fallback-Login-Seite: Wird normalerweise nicht angezeigt, da AuthProvider
 * bei `login-required` direkt zu Keycloak weiterleitet. Falls jemand /login
 * direkt aufruft, leiten wir manuell weiter.
 */
export default function LoginPage() {
  useEffect(() => {
    const kc = getKeycloak();
    if (!kc.authenticated) {
      kc.login();
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Building2 className="h-10 w-10 animate-pulse text-primary" />
        <p className="text-sm">Weiterleitung zur Anmeldung …</p>
      </div>
    </div>
  );
}
