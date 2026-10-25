import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronRight, CloudOff, Flame, Footprints } from 'lucide-react-native';
import { AppText } from '../src/components/ui/AppText';
import { Button } from '../src/components/ui/Button';
import { ProgressRing } from '../src/components/ui/ProgressRing';
import { formatWalkDate, outcomeBadge } from '../src/history/format';
import { computeStats, WEEKLY_GOAL } from '../src/history/stats';
import { fetchWalkHistory, HistoryWalk } from '../src/history/walkHistory';
import { layout, motion, Palette, radius, spacing, useColors, useThemedStyles } from '../src/theme';
import { formatDistance, formatDuration } from '../src/utils/location';

export default function HistoryScreen() {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const [walks, setWalks] = useState<HistoryWalk[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    const page = await fetchWalkHistory();
    setWalks(page.walks);
    setCursor(page.nextCursor);
    setOffline(page.offline);
  }, []);

  // Reload whenever the screen comes back into view (e.g. after deleting).
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const page = await fetchWalkHistory(cursor);
    setWalks((prev) => [...prev, ...page.walks]);
    setCursor(page.nextCursor);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={c.inkTertiary} />
      </View>
    );
  }

  const stats = computeStats(walks);

  return (
    <FlatList
      style={styles.container}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      data={walks}
      keyExtractor={(w) => w.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        walks.length > 0 ? (
          <Animated.View entering={FadeIn.duration(motion.base)} style={styles.header}>
            {offline && (
              <View style={styles.offline}>
                <CloudOff size={15} color={c.warning} />
                <AppText variant="footnote" color={c.warning}>
                  Offline. Showing walks saved on this phone.
                </AppText>
              </View>
            )}
            <View style={styles.week}>
              <View style={styles.weekTop}>
                <ProgressRing
                  progress={stats.weekWalks / WEEKLY_GOAL}
                  size={64}
                  strokeWidth={7}
                  trackColor={c.ringTrackOnForest}
                >
                  <AppText variant="headline" color={c.onForest} style={{ fontVariant: ['tabular-nums'] }}>
                    {stats.weekWalks}/{WEEKLY_GOAL}
                  </AppText>
                </ProgressRing>
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <AppText variant="headline" color={c.onForest}>
                    This week
                  </AppText>
                  {stats.streakDays > 0 ? (
                    <View style={styles.streak}>
                      <Flame size={14} color={c.mint} fill={c.mint} />
                      <AppText variant="footnote" color={c.onForestMuted}>
                        {stats.streakDays}-day streak
                      </AppText>
                    </View>
                  ) : (
                    <AppText variant="footnote" color={c.onForestMuted}>
                      Walk today to start a streak
                    </AppText>
                  )}
                </View>
              </View>
              <View style={styles.weekStats}>
                <WeekStat value={formatDistance(stats.weekDistanceMeters)} label="walked" />
                <WeekStat value={stats.weekSteps.toLocaleString()} label="steps" />
                <WeekStat value={String(stats.totalWalks)} label="walks total" />
              </View>
            </View>
            <AppText variant="footnote" style={styles.sectionLabel}>
              Recent
            </AppText>
          </Animated.View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Footprints size={28} color={c.mintInk} />
          </View>
          <AppText variant="title">No walks yet</AppText>
          <AppText variant="subhead" style={{ textAlign: 'center' }}>
            Next time you're waiting, take a short loop. It'll show up here.
          </AppText>
          <Button title="Plan a walk" variant="tinted" onPress={() => router.back()} style={{ marginTop: spacing.sm }} />
        </View>
      }
      ListFooterComponent={
        loadingMore ? <ActivityIndicator style={{ marginVertical: spacing.lg }} color={c.inkTertiary} /> : null
      }
      renderItem={({ item, index }) => {
        const badge = outcomeBadge(item, c);
        const first = index === 0;
        const last = index === walks.length - 1;
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/walk/[id]', params: { id: item.id } })}
            style={({ pressed }) => [
              styles.row,
              first && styles.rowFirst,
              last && styles.rowLast,
              pressed && styles.rowPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${formatWalkDate(item.startedAt)}, ${formatDistance(item.distanceMeters)}, ${badge.label}`}
          >
            <View style={[styles.rowInner, !first && styles.rowDivider]}>
              <View style={{ flex: 1, gap: spacing.xxs }}>
                <AppText variant="callout" style={{ fontWeight: '600' }}>
                  {formatWalkDate(item.startedAt)}
                </AppText>
                <AppText variant="footnote">
                  {formatDistance(item.distanceMeters)} · {formatDuration(item.durationSeconds)} ·{' '}
                  {item.steps.toLocaleString()} steps
                  {item.pending ? ' · not synced' : ''}
                </AppText>
              </View>
              <View style={[styles.badge, { backgroundColor: badge.background }]}>
                <AppText variant="caption" color={badge.color} style={{ fontWeight: '700' }}>
                  {badge.label}
                </AppText>
              </View>
              <ChevronRight size={16} color={c.inkTertiary} />
            </View>
          </Pressable>
        );
      }}
    />
  );
}

function WeekStat({ value, label }: { value: string; label: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <AppText variant="number" color={c.onForest}>
        {value}
      </AppText>
      <AppText variant="caption" color={c.onForestMuted}>
        {label}
      </AppText>
    </View>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.huge,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  header: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
  },
  offline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: c.warningSoft,
  },
  week: {
    padding: spacing.xl,
    gap: spacing.xl,
    backgroundColor: c.forest,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  weekTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weekStats: {
    flexDirection: 'row',
  },
  sectionLabel: {
    marginTop: spacing.sm,
    marginBottom: -spacing.sm,
    paddingHorizontal: spacing.xs,
    fontWeight: '600',
  },
  row: {
    backgroundColor: c.surface,
    paddingLeft: spacing.lg,
  },
  rowFirst: {
    marginTop: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  rowLast: {
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  rowPressed: {
    backgroundColor: c.surfaceMuted,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.md,
    minHeight: 64,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.separator,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  empty: {
    alignItems: 'center',
    paddingTop: spacing.huge * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});
