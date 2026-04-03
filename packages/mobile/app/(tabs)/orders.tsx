import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { SegmentedButtons, Text, ActivityIndicator } from 'react-native-paper';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { useMyOrders, type WorkOrderSummary } from '../../src/hooks/useMyOrders';
import { OrderCard } from '../../src/components/OrderCard';

type FilterTab = 'today' | 'planned' | 'in_progress' | 'completed';

const FILTER_MAP: Record<FilterTab, { status?: string; from?: string }> = {
  today: { from: format(new Date(), 'yyyy-MM-dd') },
  planned: { status: 'ASSIGNED' },
  in_progress: { status: 'IN_PROGRESS' },
  completed: { status: 'COMPLETED' },
};

export default function OrdersScreen() {
  const [filter, setFilter] = useState<FilterTab>('today');
  const params = FILTER_MAP[filter];

  const { data, isLoading, isRefetching, refetch } = useMyOrders(params);

  const handleOrderPress = (order: WorkOrderSummary) => {
    router.push(`/orders/${order.id}`);
  };

  const renderItem = useCallback(
    ({ item }: { item: WorkOrderSummary }) => (
      <OrderCard order={item} onPress={() => handleOrderPress(item)} />
    ),
    [],
  );

  return (
    <View style={styles.container}>
      <SegmentedButtons
        value={filter}
        onValueChange={(value) => setFilter(value as FilterTab)}
        buttons={[
          { value: 'today', label: 'Heute' },
          { value: 'planned', label: 'Geplant' },
          { value: 'in_progress', label: 'Aktiv' },
          { value: 'completed', label: 'Erledigt' },
        ]}
        style={styles.tabs}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={data?.data ?? []}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          contentContainerStyle={
            data?.data?.length === 0 ? styles.emptyContainer : styles.list
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text variant="bodyLarge" style={styles.emptyText}>
                Keine Aufträge gefunden.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  tabs: {
    marginHorizontal: 16,
    marginVertical: 12,
  },
  list: {
    paddingBottom: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
  },
});
