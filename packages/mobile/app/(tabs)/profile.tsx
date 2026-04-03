import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Surface, Divider, List } from 'react-native-paper';
import { router } from 'expo-router';
import { useAuth } from '../../src/auth/auth-context';

export default function ProfileScreen() {
  const { staff, todayOrderCount, inProgressCount, signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('Abmelden', 'Möchten Sie sich wirklich abmelden?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Abmelden',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const handleChangeServer = () => {
    Alert.alert(
      'Server ändern',
      'Dadurch werden Sie abgemeldet. Fortfahren?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Fortfahren',
          onPress: async () => {
            const { clearAllIncludingServer } = await import(
              '../../src/lib/storage'
            );
            await clearAllIncludingServer();
            const { resetApi } = await import('../../src/lib/api');
            resetApi();
            router.replace('/setup');
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profil-Karte */}
      <Surface style={styles.card} elevation={1}>
        <View style={styles.avatar}>
          <Text variant="headlineMedium" style={styles.avatarText}>
            {staff?.firstName?.[0]}
            {staff?.lastName?.[0]}
          </Text>
        </View>
        <Text variant="headlineSmall" style={styles.name}>
          {staff?.firstName} {staff?.lastName}
        </Text>
        <Text variant="bodyMedium" style={styles.staffNumber}>
          {staff?.staffNumber}
        </Text>
      </Surface>

      {/* Übersicht */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Tagesübersicht
        </Text>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text variant="displaySmall" style={styles.statNumber}>
              {todayOrderCount}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              Aufträge heute
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="displaySmall" style={[styles.statNumber, { color: '#d97706' }]}>
              {inProgressCount}
            </Text>
            <Text variant="bodySmall" style={styles.statLabel}>
              In Bearbeitung
            </Text>
          </View>
        </View>
      </Surface>

      {/* Kontakt */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Kontaktdaten
        </Text>
        {staff?.email && (
          <List.Item
            title={staff.email}
            left={(props) => <List.Icon {...props} icon="email-outline" />}
          />
        )}
        {staff?.phone && (
          <List.Item
            title={staff.phone}
            left={(props) => <List.Icon {...props} icon="phone-outline" />}
          />
        )}
        {staff?.mobile && (
          <List.Item
            title={staff.mobile}
            left={(props) => <List.Icon {...props} icon="cellphone" />}
          />
        )}
      </Surface>

      {/* Aktionen */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={handleChangeServer}
          icon="server-network"
          style={styles.actionButton}
        >
          Server-URL ändern
        </Button>
        <Button
          mode="contained"
          onPress={handleLogout}
          icon="logout"
          buttonColor="#dc2626"
          style={styles.actionButton}
        >
          Abmelden
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  card: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  name: {
    fontWeight: '600',
    textAlign: 'center',
  },
  staffNumber: {
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontWeight: '700',
    color: '#1e40af',
  },
  statLabel: {
    color: '#64748b',
    marginTop: 4,
  },
  actions: {
    padding: 16,
    gap: 12,
    marginBottom: 32,
  },
  actionButton: {
    borderRadius: 8,
  },
});
