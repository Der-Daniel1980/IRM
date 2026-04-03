import React from 'react';
import { View, ScrollView, StyleSheet, Linking, Platform } from 'react-native';
import { Text, Surface, Button, ActivityIndicator, Icon, Divider } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useMyOrder } from '../../src/hooks/useMyOrders';
import { StatusBadge, PriorityBadge } from '../../src/components/StatusBadge';
import { TimeTracker } from '../../src/components/TimeTracker';
import { PhotoGallery } from '../../src/components/PhotoGallery';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, isLoading, error } = useMyOrder(id);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !order) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyLarge" style={styles.errorText}>
          Auftrag konnte nicht geladen werden.
        </Text>
      </View>
    );
  }

  const plannedDate = order.plannedDate
    ? format(new Date(order.plannedDate), 'EEEE, dd. MMMM yyyy', { locale: de })
    : null;
  const plannedTime = order.plannedStartTime
    ? format(new Date(order.plannedStartTime), 'HH:mm')
    : null;

  const openMaps = () => {
    const lat = order.property.latitude;
    const lng = order.property.longitude;
    if (lat && lng) {
      const url = Platform.select({
        ios: `maps://app?daddr=${lat},${lng}`,
        android: `google.navigation:q=${lat},${lng}`,
      });
      if (url) Linking.openURL(url);
    } else {
      const address = `${order.property.addressStreet}, ${order.property.addressZip} ${order.property.addressCity}`;
      const url = Platform.select({
        ios: `maps://app?daddr=${encodeURIComponent(address)}`,
        android: `google.navigation:q=${encodeURIComponent(address)}`,
      });
      if (url) Linking.openURL(url);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Surface style={styles.card} elevation={1}>
        <View style={styles.headerRow}>
          <Text variant="labelSmall" style={styles.orderNumber}>
            {order.orderNumber}
          </Text>
          <View style={styles.badges}>
            <PriorityBadge priority={order.priority} />
            <StatusBadge status={order.status} />
          </View>
        </View>
        <Text variant="headlineSmall" style={styles.title}>
          {order.title}
        </Text>
        {order.description && (
          <Text variant="bodyMedium" style={styles.description}>
            {order.description}
          </Text>
        )}
      </Surface>

      {/* Immobilie */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Immobilie
        </Text>
        <Text variant="titleMedium" style={styles.propertyName}>
          {order.property.name}
        </Text>
        <View style={styles.row}>
          <Icon source="map-marker-outline" size={16} color="#64748b" />
          <Text variant="bodyMedium" style={styles.meta}>
            {order.property.addressStreet}
          </Text>
        </View>
        <View style={styles.row}>
          <Icon source="city-variant-outline" size={16} color="#64748b" />
          <Text variant="bodyMedium" style={styles.meta}>
            {order.property.addressZip} {order.property.addressCity}
          </Text>
        </View>
        <View style={styles.row}>
          <Icon source="domain" size={16} color="#64748b" />
          <Text variant="bodyMedium" style={styles.meta}>
            {order.customer.companyName}
          </Text>
        </View>
        <Button
          mode="contained-tonal"
          onPress={openMaps}
          icon="navigation-variant-outline"
          style={styles.navButton}
          compact
        >
          Navigation starten
        </Button>
      </Surface>

      {/* Tätigkeit + Zeitplan */}
      <Surface style={styles.card} elevation={1}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Auftragsdaten
        </Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text variant="labelSmall" style={styles.infoLabel}>
              Tätigkeit
            </Text>
            <Text variant="bodyMedium">{order.activityType.name}</Text>
          </View>
          {plannedDate && (
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.infoLabel}>
                Geplantes Datum
              </Text>
              <Text variant="bodyMedium">{plannedDate}</Text>
            </View>
          )}
          {plannedTime && (
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.infoLabel}>
                Uhrzeit
              </Text>
              <Text variant="bodyMedium">{plannedTime} Uhr</Text>
            </View>
          )}
          {order.plannedDurationMin && (
            <View style={styles.infoItem}>
              <Text variant="labelSmall" style={styles.infoLabel}>
                Geplante Dauer
              </Text>
              <Text variant="bodyMedium">{order.plannedDurationMin} Min.</Text>
            </View>
          )}
        </View>
        {order.notes && (
          <>
            <Divider style={styles.divider} />
            <Text variant="labelSmall" style={styles.infoLabel}>
              Notizen
            </Text>
            <Text variant="bodyMedium" style={styles.notes}>
              {order.notes}
            </Text>
          </>
        )}
      </Surface>

      {/* Zeiterfassung */}
      <TimeTracker
        orderId={order.id}
        orderStatus={order.status}
        actualStart={order.actualStart}
        actualDurationMin={order.actualDurationMin}
      />

      {/* Fotos */}
      <PhotoGallery orderId={order.id} />

      {/* Abschlussnotizen */}
      {order.completionNotes && (
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Abschlussnotizen
          </Text>
          <Text variant="bodyMedium">{order.completionNotes}</Text>
        </Surface>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#dc2626',
  },
  card: {
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderNumber: {
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  title: {
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    color: '#475569',
    marginTop: 4,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  propertyName: {
    fontWeight: '600',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  meta: {
    color: '#475569',
    flex: 1,
  },
  navButton: {
    marginTop: 12,
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    gap: 2,
  },
  infoLabel: {
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    marginVertical: 12,
  },
  notes: {
    color: '#475569',
    marginTop: 4,
  },
  bottomSpacer: {
    height: 32,
  },
});
