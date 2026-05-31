import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { requireAuth } from '../../services/auth';

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    const currentSegment = segments[segments.length - 1] ?? 'dashboard';
    requireAuth(router, { pathname: `/(tabs)/${currentSegment}` });
  }, [router, segments]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#6c63ff',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            // Using text as icon fallback – @expo/vector-icons will work at runtime
            <TabIcon name="list" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarLabel: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="bell" color={color} size={size} />
          ),
          tabBarBadge: undefined, // set dynamically when we have unread count
        }}
      />
    </Tabs>
  );
}

/** Lightweight icon stub – renders a colored circle glyph. Replaced by @expo/vector-icons at runtime */
function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  const glyphs: Record<string, string> = {
    list: '≡',
    bell: '🔔',
    plus: '＋',
  };
  return (
    <Text style={{ color, fontSize: size - 4 }}>
      {glyphs[name] ?? '●'}
    </Text>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#1a1a2e',
    borderTopColor: '#2d2d44',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 4,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
