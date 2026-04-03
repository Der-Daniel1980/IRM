import React, { useState } from 'react';
import { View, StyleSheet, Image, FlatList, Alert } from 'react-native';
import { Button, Text, Surface, IconButton, Menu } from 'react-native-paper';
import {
  useOrderPhotos,
  useUploadPhoto,
  useDeletePhoto,
  pickImageFromCamera,
  pickImageFromGallery,
} from '../hooks/usePhotoUpload';
import { getServerUrl, getAccessToken } from '../lib/storage';

interface PhotoGalleryProps {
  orderId: string;
}

export function PhotoGallery({ orderId }: PhotoGalleryProps) {
  const { data: photos, isLoading } = useOrderPhotos(orderId);
  const uploadPhoto = useUploadPhoto();
  const deletePhoto = useDeletePhoto();
  const [menuVisible, setMenuVisible] = useState(false);

  const handleCamera = async () => {
    setMenuVisible(false);
    const uri = await pickImageFromCamera();
    if (uri) {
      uploadPhoto.mutate({ orderId, uri });
    }
  };

  const handleGallery = async () => {
    setMenuVisible(false);
    const uri = await pickImageFromGallery();
    if (uri) {
      uploadPhoto.mutate({ orderId, uri });
    }
  };

  const handleDelete = (photoId: string) => {
    Alert.alert('Foto löschen', 'Möchten Sie dieses Foto wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Löschen',
        style: 'destructive',
        onPress: () => deletePhoto.mutate({ orderId, photoId }),
      },
    ]);
  };

  const [serverUrl, setServerUrlState] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  React.useEffect(() => {
    getServerUrl().then(setServerUrlState);
    getAccessToken().then(setToken);
  }, []);

  return (
    <Surface style={styles.container} elevation={1}>
      <View style={styles.header}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Fotos ({photos?.length ?? 0})
        </Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="contained-tonal"
              onPress={() => setMenuVisible(true)}
              loading={uploadPhoto.isPending}
              icon="camera-plus-outline"
              compact
            >
              Hinzufügen
            </Button>
          }
        >
          <Menu.Item
            onPress={handleCamera}
            title="Foto aufnehmen"
            leadingIcon="camera"
          />
          <Menu.Item
            onPress={handleGallery}
            title="Aus Galerie wählen"
            leadingIcon="image-multiple"
          />
        </Menu>
      </View>

      {photos && photos.length > 0 ? (
        <FlatList
          data={photos}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.photoItem}>
              <Image
                source={{
                  uri: serverUrl
                    ? `${serverUrl}/api/v1/mobile/photos/${item.id}/file`
                    : undefined,
                  headers: token
                    ? { Authorization: `Bearer ${token}` }
                    : undefined,
                }}
                style={styles.photo}
                resizeMode="cover"
              />
              <IconButton
                icon="delete-outline"
                size={18}
                iconColor="#dc2626"
                style={styles.deleteButton}
                onPress={() => handleDelete(item.id)}
              />
              {item.caption && (
                <Text variant="labelSmall" style={styles.caption} numberOfLines={1}>
                  {item.caption}
                </Text>
              )}
            </View>
          )}
          contentContainerStyle={styles.photoList}
        />
      ) : (
        <Text variant="bodySmall" style={styles.emptyText}>
          Noch keine Fotos vorhanden.
        </Text>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    color: '#1e293b',
  },
  photoList: {
    gap: 8,
  },
  photoItem: {
    position: 'relative',
    width: 120,
    marginRight: 8,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
  },
  deleteButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    margin: 0,
  },
  caption: {
    marginTop: 4,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
