import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { getApi } from '../lib/api';

export interface WorkOrderPhoto {
  id: string;
  workOrderId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  takenAt: string | null;
  createdAt: string;
}

export function useOrderPhotos(orderId: string) {
  return useQuery<WorkOrderPhoto[]>({
    queryKey: ['order-photos', orderId],
    queryFn: async () => {
      const api = await getApi();
      const { data } = await api.get(`/mobile/my-orders/${orderId}/photos`);
      return data;
    },
    enabled: !!orderId,
  });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      uri,
      caption,
      latitude,
      longitude,
    }: {
      orderId: string;
      uri: string;
      caption?: string;
      latitude?: number;
      longitude?: number;
    }) => {
      const api = await getApi();
      const formData = new FormData();

      // Dateiname und Typ aus URI ableiten
      const filename = uri.split('/').pop() ?? 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photos', {
        uri,
        name: filename,
        type,
      } as any);

      if (caption) formData.append('caption', caption);
      if (latitude != null) formData.append('latitude', String(latitude));
      if (longitude != null) formData.append('longitude', String(longitude));

      const { data } = await api.post(
        `/mobile/my-orders/${orderId}/photos`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        },
      );
      return data;
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order-photos', orderId] });
      queryClient.invalidateQueries({ queryKey: ['my-order', orderId] });
    },
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      photoId,
    }: {
      orderId: string;
      photoId: string;
    }) => {
      const api = await getApi();
      await api.delete(`/mobile/my-orders/${orderId}/photos/${photoId}`);
    },
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['order-photos', orderId] });
      queryClient.invalidateQueries({ queryKey: ['my-order', orderId] });
    },
  });
}

export async function pickImageFromCamera(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
    exif: true,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}

export async function pickImageFromGallery(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
    exif: true,
  });

  if (result.canceled || !result.assets[0]) return null;
  return result.assets[0].uri;
}
