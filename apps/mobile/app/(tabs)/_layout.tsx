import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requireAuth } from '../../services/auth';
import { useSession } from '../../hooks/useSession';
import { useNotifications } from '../../hooks/useNotifications';
import { ReadOnlyBanner } from '../../components/ReadOnlyBanner';

export default function TabLayout() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { isGuest, isHydrated, accessMode, exitGuestMode } = useSession();
  const { unreadCount } = useNotifications();

  useEffect(() => {
    if (!isHydrated) return;
    const currentSegment = segments[segments.length - 1] ?? 'dashboard';
    requireAuth(router, { pathname: `/(tabs)/${currentSegment}` });
  }, [router, segments, isHydrated, accessMode]);

  const handleConnectFromBanner = () => {
    exitGuestMode();
    router.replace('/');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {isGuest && <ReadOnlyBanner onConnect={handleConnectFromBanner} />}

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: [
            styles.tabBar,
            { height: 60 + insets.bottom, paddingBottom: 4 + insets.bottom },
          ],
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
            tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#ff4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: '700',
              minWidth: 18,
              height: 18,
              lineHeight: 18,
              borderRadius: 9,
              textAlign: 'center',
              paddingHorizontal: 4,
            },
          }}
        />
        {/* #552 – Settings was unreachable until this entry existed */}
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarLabel: 'Settings',
            tabBarAccessibilityLabel: 'Settings tab',
            tabBarIcon: ({ color, size }) => (
              <TabIcon name="gear" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

/** Lightweight icon stub – renders a colored circle glyph. Replaced by @expo/vector-icons at runtime */
function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  const glyphs: Record<string, string> = {
    list: '≡',
    bell: '🔔',
    plus: '＋',
    gear: '⚙',
  };
  return (
    <Text style={{ color, fontSize: size - 4 }}>
      {glyphs[name] ?? '●'}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#12121f',
  },
  tabBar: {
    backgroundColor: '#1a1a2e',
    borderTopColor: '#2d2d44',
    borderTopWidth: 1,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
