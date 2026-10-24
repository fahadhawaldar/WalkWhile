import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CloudOff, Footprints, Route, Timer } from 'lucide-react-native';
import { formatWalkDate, outcomeBadge } from '../src/history/format';
import { fetchWalkHistory, HistoryWalk } from '../src/history/walkHistory';
import { COLORS } from '../src/theme/colors';
import { formatDistance, formatDuration } from '../src/utils/location';

function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

export default function HistoryScreen() {
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

  const weekStart = startOfWeek(new Date()).getTime();
  const thisWeek = walks.filter((w) => new Date(w.startedAt).getTime() >= weekStart);
  const weekDistance = thisWeek.reduce((sum, w) => sum + w.distanceMeters, 0);
  const weekSteps = thisWeek.reduce((sum, w) => sum + w.steps, 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={walks}
      keyExtractor={(w) => w.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={
        <View>
          {offline && (
            <View style={styles.offlineBanner}>
              <CloudOff size={16} color="#92400E" />
              <Text style={styles.offlineText}>
                Offline. Showing walks saved on this phone.
              </Text>
            </View>
          )}
          <View style={styles.weekCard}>
            <Text style={styles.weekLabel}>THIS WEEK</Text>
            <View style={styles.weekRow}>
              <View style={styles.weekCell}>
                <Text style={styles.weekValue}>{thisWeek.length}</Text>
                <Text style={styles.weekUnit}>{thisWeek.length === 1 ? 'walk' : 'walks'}</Text>
              </View>
              <View style={styles.weekCell}>
                <Text style={styles.weekValue}>{formatDistance(weekDistance)}</Text>
                <Text style={styles.weekUnit}>walked</Text>
              </View>
              <View style={styles.weekCell}>
                <Text style={styles.weekValue}>{weekSteps.toLocaleString()}</Text>
                <Text style={styles.weekUnit}>steps</Text>
              </View>
            </View>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Footprints size={36} color={COLORS.textMuted} />
          <Text style={styles.emptyTitle}>No walks yet</Text>
          <Text style={styles.emptyText}>
            Your walks will show up here once you finish one.
          </Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={COLORS.primary} /> : null
      }
      renderItem={({ item }) => {
        const badge = outcomeBadge(item);
        return (
          <TouchableOpacity
            style={styles.walkCard}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/walk/[id]', params: { id: item.id } })}
          >
            <View style={styles.walkTop}>
              <Text style={styles.walkDate}>{formatWalkDate(item.startedAt)}</Text>
              <View style={[styles.badge, { backgroundColor: badge.background }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            </View>
            <View style={styles.walkStats}>
              <View style={styles.stat}>
                <Route size={14} color={COLORS.textSecondary} />
                <Text style={styles.statText}>{formatDistance(item.distanceMeters)}</Text>
              </View>
              <View style={styles.stat}>
                <Timer size={14} color={COLORS.textSecondary} />
                <Text style={styles.statText}>{formatDuration(item.durationSeconds)}</Text>
              </View>
              <View style={styles.stat}>
                <Footprints size={14} color={COLORS.textSecondary} />
                <Text style={styles.statText}>{item.steps.toLocaleString()} steps</Text>
              </View>
            </View>
            {item.pending && <Text style={styles.pendingText}>Not synced yet</Text>}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    marginBottom: 10,
  },
  offlineText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  weekCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 18,
    marginBottom: 6,
  },
  weekLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: COLORS.accentSoft,
    marginBottom: 10,
  },
  weekRow: {
    flexDirection: 'row',
  },
  weekCell: {
    flex: 1,
  },
  weekValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  weekUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.accentSoft,
  },
  walkCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  walkTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  walkDate: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  walkStats: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  pendingText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
