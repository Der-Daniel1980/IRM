import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, HelperText, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { setServerUrl } from '../src/lib/storage';
import { validateServerUrl, resetApi } from '../src/lib/api';

export default function SetupScreen() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setError('');

    const cleanUrl = url.trim().replace(/\/+$/, '');
    if (!cleanUrl) {
      setError('Bitte geben Sie die Server-URL ein.');
      return;
    }

    // URL-Format prüfen
    try {
      new URL(cleanUrl);
    } catch {
      setError('Ungültiges URL-Format. Beispiel: https://irm.meinefirma.de');
      return;
    }

    setLoading(true);
    try {
      const valid = await validateServerUrl(cleanUrl);
      if (!valid) {
        setError(
          'Server nicht erreichbar oder kein IRM-Server. Bitte URL prüfen.',
        );
        setLoading(false);
        return;
      }

      await setServerUrl(cleanUrl);
      resetApi();
      router.replace('/login');
    } catch {
      setError('Verbindungsfehler. Bitte prüfen Sie die URL und Ihre Internetverbindung.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <Surface style={styles.card} elevation={2}>
          <Text variant="headlineMedium" style={styles.title}>
            IRM Mobile
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Immobilien- & Ressourcenmanagement
          </Text>
          <Text variant="bodyMedium" style={styles.description}>
            Bitte geben Sie die URL Ihres IRM-Servers ein, um die App zu verbinden.
          </Text>

          <TextInput
            label="Server-URL"
            value={url}
            onChangeText={(text) => {
              setUrl(text);
              setError('');
            }}
            placeholder="https://irm.meinefirma.de"
            mode="outlined"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={handleConnect}
            style={styles.input}
            left={<TextInput.Icon icon="server" />}
          />

          <HelperText type="error" visible={!!error}>
            {error}
          </HelperText>

          <Button
            mode="contained"
            onPress={handleConnect}
            loading={loading}
            disabled={loading || !url.trim()}
            style={styles.button}
            icon="connection"
          >
            Verbinden
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
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748b',
    marginBottom: 24,
  },
  description: {
    textAlign: 'center',
    color: '#475569',
    marginBottom: 24,
  },
  input: {
    marginBottom: 4,
  },
  button: {
    marginTop: 8,
    paddingVertical: 4,
  },
});
