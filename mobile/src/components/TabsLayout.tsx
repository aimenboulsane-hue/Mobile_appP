import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontWeight, tabBar } from '@/theme';

export type TabItem = {
  name: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export function TabsLayout({ tabs }: { tabs: TabItem[] }) {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: { fontSize: tabBar.labelSize, fontWeight: fontWeight.medium },
        tabBarItemStyle: { paddingHorizontal: 0 },
        tabBarAllowFontScaling: false,
        tabBarStyle: {
          height: tabBar.height + insets.bottom,
          paddingBottom: insets.bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}>
      {tabs.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ focused }) => (
              <Ionicons name={tab.icon} size={tabBar.iconSize}
                color={focused ? colors.primary : colors.textMuted} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
