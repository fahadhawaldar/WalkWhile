import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { WalkingRoute } from '@walkwhile/shared';
import { UniversalMap } from '../../src/components/UniversalMap';
import { formatWalkDate, outcomeBadge } from '../../src/history/format';
import { deleteWalk, getWalk, HistoryWalk } from '../../src/history/walkHistory';
import { AppText } from '../../src/components/ui/AppText';
import { Button } from '../../src/components/ui/Button';
import { layout, Palette, radius, shadows, spacing, useColors, useThemedStyles } from '../../src/theme';
import { formatDistance, formatDuration } from '../../src/utils/location';

export default function WalkDetailScreen() {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [walk, setWalk] = useState<HistoryWalk | null | undefined>(undefined);

  useEffect(() => {
    getWalk(id)
      .then(setWalk)
      .catch(() => setWalk(null));
  }, [id]);

  if (walk === undefined) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={c.inkTertiary} />
      </View>
    );
  }
  if (walk === null) {
    return (
      <View style={styles.centered}>
        <AppText variant="subhead">This walk couldn't be loaded.</AppText>
      </View>
    );
  }

  const badge = outcomeBadge(walk, c);
  // The map draws WalkingRoutes; a saved walk only keeps the line itself.
  const route: WalkingRoute | null =
    walk.routeCoordinates.length > 1
      ? {
          id: walk.id,
          type: 'loop',
          geometry: { type: 'LineString', coordinates: walk.routeCoordinates },
          distanceMeters: walk.distanceMeters,
          durationSeconds: walk.durationSeconds,
          calibratedDurationSeconds: walk.durationSeconds,
          instructions: [],
          warnings: [],
        }
      : null;

  const confirmDelete = () => {
    Alert.alert('Delete walk', 'This removes the walk from your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWalk(walk.id);
            router.back();
          } catch {
            Alert.alert('Delete failed', 'Check your connection and try again.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: formatWalkDate(walk.startedAt) }} />

      <View style={styles.headerRow}>
        <View style={[styles.badge, { backgroundColor: badge.background }]}>
          <AppText variant="footnote" color={badge.color} style={{ fontWeight: '700' }}>
            {badge.label}
          </AppText>
        </View>
        <AppText variant="footnote">
          {walk.waitType === 'flexible' ? 'Someone was coming' : 'Exact-time wait'} ·{' '}
          {Math.round(walk.plannedMinutes)} min planned
        </AppText>
      </View>

      {route && (
        <View style={styles.map}>
          <UniversalMap origin={walk.origin} routes={[route]} selectedRouteIndex={0} height={280} />
        </View>
      )}

      <View style={styles.stats}>
        <Stat value={formatDistance(walk.distanceMeters)} label="distance" />
        <View style={styles.divider} />
        <Stat value={formatDuration(walk.durationSeconds)} label="time" />
        <View style={styles.divider} />
        <Stat value={walk.steps.toLocaleString()} label="steps" />
      </View>

      {walk.pending && (
        <AppText variant="caption" style={{ textAlign: 'center' }}>
          Saved on this phone, not synced to your account yet.
        </AppText>
      )}

      <Button
        title="Delete walk"
        variant="danger"
        onPress={confirmDelete}
        icon={<Trash2 size={16} color={c.urgent} />}
        style={{ marginTop: spacing.lg }}
      />
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <AppText variant="number">{value}</AppText>
      <AppText variant="caption">{label}</AppText>
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
    padding: layout.screenPadding,
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.full,
  },
  map: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  stats: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    ...shadows.card,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xxs,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: c.separator,
  },
});
