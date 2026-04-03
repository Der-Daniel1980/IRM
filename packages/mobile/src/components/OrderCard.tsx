import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Card, Text, Icon } from 'react-native-paper';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { StatusBadge, PriorityBadge } from './StatusBadge';
import type { WorkOrderSummary } from '../hooks/useMyOrders';

interface OrderCardProps {
  order: WorkOrderSummary;
  onPress: () => void;
}

export function OrderCard({ order, onPress }: OrderCardProps) {
  const plannedTime = order.plannedStartTime
    ? format(new Date(order.plannedStartTime), 'HH:mm')
    : null;
  const plannedDate = order.plannedDate
    ? format(new Date(order.plannedDate), 'dd.MM.yyyy', { locale: de })
    : null;

  return (
    <Pressable onPress={onPress}>
      <Card style={styles.card} mode="outlined">
        <Card.Content>
          {/* Header: Nummer + Status */}
          <View style={styles.header}>
            <Text variant="labelSmall" style={styles.orderNumber}>
              {order.orderNumber}
            </Text>
            <View style={styles.badges}>
              <PriorityBadge priority={order.priority} />
              <StatusBadge status={order.status} />
            </View>
          </View>

          {/* Titel */}
          <Text variant="titleMedium" style={styles.title} numberOfLines={2}>
            {order.title}
          </Text>

          {/* Tätigkeit */}
          <View style={styles.row}>
            <Icon source="clipboard-list-outline" size={16} color="#64748b" />
            <Text variant="bodySmall" style={styles.meta}>
              {order.activityType.name}
            </Text>
          </View>

          {/* Adresse */}
          <View style={styles.row}>
            <Icon source="map-marker-outline" size={16} color="#64748b" />
            <Text variant="bodySmall" style={styles.meta} numberOfLines={1}>
              {order.property.addressStreet}, {order.property.addressZip}{' '}
              {order.property.addressCity}
            </Text>
          </View>

          {/* Zeit */}
          <View style={styles.footer}>
            {plannedDate && (
              <View style={styles.row}>
                <Icon source="calendar-outline" size={14} color="#64748b" />
                <Text variant="bodySmall" style={styles.meta}>
                  {plannedDate}
                  {plannedTime ? ` um ${plannedTime}` : ''}
                </Text>
              </View>
            )}
            {order.plannedDurationMin && (
              <View style={styles.row}>
                <Icon source="clock-outline" size={14} color="#64748b" />
                <Text variant="bodySmall" style={styles.meta}>
                  {order.plannedDurationMin} Min.
                </Text>
              </View>
            )}
            {order.photos.length > 0 && (
              <View style={styles.row}>
                <Icon source="camera-outline" size={14} color="#64748b" />
                <Text variant="bodySmall" style={styles.meta}>
                  {order.photos.length}
                </Text>
              </View>
            )}
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 12,
  },
  header: {
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
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  meta: {
    color: '#64748b',
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
});
