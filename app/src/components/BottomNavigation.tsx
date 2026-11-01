import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

type Tab = 'today' | 'calendar' | 'tasks' | 'account';

const tabs: { key: Tab; label: string; icon: string; route: Href }[] = [
  { key: 'today', label: "Aujourd'hui", icon: '⌂', route: '/' },
  { key: 'calendar', label: 'Calendrier', icon: '▦', route: '/calendar' },
  { key: 'tasks', label: 'Mes petits pas', icon: '☷', route: '/tasks' },
  { key: 'account', label: 'Mon compte', icon: '♙', route: '/profile' },
];

export function BottomNavigation({ active }: { active: Tab }) {
  const colors = useAppTheme().colors;
  const styles = createStyles(colors);
  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => router.navigate(tab.route)}
            style={styles.item}>
            <Text style={[styles.icon, selected && styles.iconSelected]}>{tab.icon}</Text>
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 3,
  },
  icon: {
    color: palette.textSecondary,
    fontSize: 19,
  },
  iconSelected: {
    color: palette.sage,
    fontSize: 20,
  },
  label: {
    color: palette.textSecondary,
    fontSize: 9,
  },
  labelSelected: {
    color: palette.sage,
    fontSize: 9,
    fontWeight: '700',
  },
});
