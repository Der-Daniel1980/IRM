import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApi } from './api';

const QUEUE_KEY = 'irm_offline_queue';

export interface QueuedAction {
  id: string;
  type: 'start' | 'stop' | 'time-entry' | 'photo';
  orderId: string;
  payload: Record<string, any>;
  createdAt: string;
  retryCount: number;
}

export async function enqueue(action: Omit<QueuedAction, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
  const queue = await getQueue();
  queue.push({
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueue(): Promise<QueuedAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function processQueue(): Promise<{ success: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      const api = await getApi();
      switch (action.type) {
        case 'start':
          await api.post(`/mobile/my-orders/${action.orderId}/start`, {});
          break;
        case 'stop':
          await api.post(`/mobile/my-orders/${action.orderId}/stop`, action.payload);
          break;
        case 'time-entry':
          await api.post(
            `/mobile/my-orders/${action.orderId}/time-entry`,
            action.payload,
          );
          break;
        // Foto-Upload wird nicht über die Standard-Queue abgewickelt
        // (separate Logik mit FormData nötig)
        default:
          remaining.push(action);
          continue;
      }
      success++;
    } catch {
      action.retryCount++;
      if (action.retryCount < 5) {
        remaining.push(action);
      }
      failed++;
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return { success, failed };
}
