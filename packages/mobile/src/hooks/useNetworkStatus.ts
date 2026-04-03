import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { processQueue } from '../lib/offline-queue';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  const checkConnectivity = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      // Einfacher Konnektivitätstest
      const { getServerUrl } = await import('../lib/storage');
      const serverUrl = await getServerUrl();
      if (!serverUrl) {
        setIsOnline(false);
        return;
      }
      const response = await fetch(`${serverUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsOnline(response.ok);

      if (response.ok) {
        await processQueue();
      }
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    checkConnectivity();

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          checkConnectivity();
        }
      },
    );

    // Alle 30 Sekunden prüfen
    const interval = setInterval(checkConnectivity, 30000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [checkConnectivity]);

  return { isOnline, checkConnectivity };
}
