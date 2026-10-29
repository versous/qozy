import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/theme/colors';

type Tab = 'today' | 'calendar' | 'tasks' | 'account';

const tabs: { key: Tab; label: string; icon: string; route: Href }[] = [
  { key: 'today', label: "Aujourd'hui", icon: '⌂', route: '/' },
  { key: 'calendar', label: 'Calendrier', icon: '▦', route: '/calendar' },
  { key: 'tasks', label: 'Mes tâches', icon: '☷', route: '/tasks' },
  { key: 'account', label: 'Mon compte', icon: '♙', route: '/profile' },
];

export function BottomNavigation({ active }: { active: Tab }) {
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => router.replace(tab.route)}
            style={styles.item}>
            <Text style={[styles.icon, selected && styles.iconSelected]}>{tab.icon}</Text>
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 3,
  },
  icon: {
    color: colors.textSecondary,
    fontSize: 19,
  },
  iconSelected: {
    color: colors.sage,
    fontSize: 20,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 9,
  },
  labelSelected: {
    color: colors.sage,
    fontSize: 9,
    fontWeight: '700',
  },
});
