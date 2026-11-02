import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { spacing, type AppColors } from '@/theme/colors';
import { useAppTheme } from '@/theme/ThemeProvider';

type Tab = 'today' | 'tasks' | 'account';

const tabs: { key: Tab; label: string; route: Href }[] = [
  { key: 'today', label: "Aujourd'hui", route: '/' },
  { key: 'tasks', label: 'Mes tâches', route: '/tasks' },
  { key: 'account', label: 'Mon compte', route: '/profile' },
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
            <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
              <TabIcon tab={tab.key} color={selected ? colors.sage : colors.textSecondary} />
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TabIcon({ tab, color }: { tab: Tab; color: string }) {
  if (tab === 'today') {
    return (
      <Svg width={19} height={19} viewBox="0 0 24 24">
        <Path d="m3.5 10 8.5-7 8.5 7v10.5H14v-7h-4v7H3.5V10Z" fill="none" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      </Svg>
    );
  }

  if (tab === 'tasks') {
    return (
      <Svg width={19} height={19} viewBox="0 0 24 24">
        <Rect x={4} y={4} width={16} height={16} rx={4} fill="none" stroke={color} strokeWidth={1.7} />
        <Path d="m7.5 12 2.7 2.7 6.3-6.2" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }

  return (
    <Svg width={19} height={19} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={3.5} fill="none" stroke={color} strokeWidth={1.7} />
      <Path d="M4.5 20c.5-3.8 3.3-6 7.5-6s7 2.2 7.5 6" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}

const createStyles = (palette: AppColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    backgroundColor: palette.surface,
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.xs,
  },
  iconWrap: {
    width: 34,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  iconWrapSelected: {
    backgroundColor: palette.sagePale,
  },
  label: {
    color: palette.textSecondary,
    fontSize: 10,
  },
  labelSelected: {
    color: palette.sage,
    fontWeight: '700',
  },
});
