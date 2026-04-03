import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  useAuthRequest,
  exchangeCodeAsync,
  ResponseType,
  getRedirectUri,
  getKeycloakDiscovery,
  KEYCLOAK_CLIENT_ID,
} from '../src/auth/keycloak';
import { useAuth } from '../src/auth/auth-context';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discovery, setDiscovery] = useState<any>(null);

  useEffect(() => {
    getKeycloakDiscovery().then(setDiscovery);
  }, []);

  const redirectUri = getRedirectUri();

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: KEYCLOAK_CLIENT_ID,
      redirectUri,
      responseType: ResponseType.Code,
      usePKCE: true,
      scopes: ['openid', 'profile', 'email'],
    },
    discovery,
  );

  useEffect(() => {
    if (response?.type === 'success' && discovery) {
      const { code } = response.params;
      setLoading(true);
      exchangeCodeAsync(
        {
          clientId: KEYCLOAK_CLIENT_ID,
          code,
          redirectUri,
          extraParams: {
            code_verifier: request?.codeVerifier ?? '',
          },
        },
        discovery,
      )
        .then(async (tokenResponse) => {
          await signIn(
            tokenResponse.accessToken,
            tokenResponse.refreshToken ?? undefined,
          );
          router.replace('/(tabs)/orders');
        })
        .catch((err) => {
          setError('Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.');
          console.error('Token exchange error:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [response]);

  const handleLogin = () => {
    setError('');
    promptAsync();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Surface style={styles.card} elevation={2}>
          <Text variant="headlineMedium" style={styles.title}>
            Anmeldung
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            Melden Sie sich mit Ihren IRM-Zugangsdaten an.
          </Text>

          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading || !request}
            style={styles.button}
            icon="login"
          >
            Mit IRM-Konto anmelden
          </Button>

          <Button
            mode="text"
            onPress={() => router.replace('/setup')}
            style={styles.linkButton}
          >
            Server-URL ändern
          </Button>
        </Surface>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  title: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 8,
  },
  description: {
    textAlign: 'center',
    color: '#475569',
    marginBottom: 24,
  },
  button: {
    marginTop: 8,
    paddingVertical: 4,
  },
  linkButton: {
    marginTop: 16,
  },
});
