import { Tabs, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Bell, LayoutDashboard, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { requireAuth } from '../../services/auth';
import { useSession } from '../../hooks/useSession';
import { useNotifications } from '../../hooks/useNotifications';
import { ReadOnlyBanner } from '../../components/ReadOnlyBanner';
import { colors } from '../../theme';

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
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Dashboard',
            tabBarLabel: 'Dashboard',
            tabBarIcon: ({ color, size }) => (
              <LayoutDashboard color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Notifications',
            tabBarLabel: 'Alerts',
            tabBarIcon: ({ color, size }) => (
              <Bell color={color} size={size} />
            ),
            tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
            tabBarBadgeStyle: {
              backgroundColor: colors.danger,
              color: colors.text,
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
              <Settings color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.surfaceRaised,
    borderTopWidth: 1,
    paddingTop: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
