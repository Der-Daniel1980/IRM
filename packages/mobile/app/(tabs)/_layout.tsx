import React from 'react';
import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';

export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.primary,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.secondary,
        tabBarStyle: { backgroundColor: theme.colors.surface },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Aufträge',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="clipboard-text-outline" color={color} size={size} />
          ),
          headerTitle: 'Meine Aufträge',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="account-cog-outline" color={color} size={size} />
          ),
          headerTitle: 'Mein Profil',
        }}
      />
    </Tabs>
  );
}

// Einfaches Icon-Wrapper für react-native-paper
function TabIcon({
  name,
  color,
  size,
}: {
  name: string;
  color: string;
  size: number;
}) {
  // react-native-paper Icon via MaterialCommunityIcons
  const Icon = require('react-native-paper').Icon;
  return <Icon source={name} size={size} color={color} />;
}
