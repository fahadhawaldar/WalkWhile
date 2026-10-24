import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Footprints, Route, Timer, Trash2 } from 'lucide-react-native';
import { WalkingRoute } from '@walkwhile/shared';
import { UniversalMap } from '../../src/components/UniversalMap';
import { formatWalkDate, outcomeBadge } from '../../src/history/format';
import { deleteWalk, getWalk, HistoryWalk } from '../../src/history/walkHistory';
import { COLORS } from '../../src/theme/colors';
import { formatDistance, formatDuration } from '../../src/utils/location';

export default function WalkDetailScreen() {
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
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (walk === null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missing}>This walk couldn't be loaded.</Text>
      </View>
    );
  }

  const badge = outcomeBadge(walk);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.date}>{formatWalkDate(walk.startedAt)}</Text>
        <View style={[styles.badge, { backgroundColor: badge.background }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        {walk.waitType === 'flexible' ? 'Someone was coming' : 'Exact-time wait'} ·{' '}
        {Math.round(walk.plannedMinutes)} min planned
      </Text>

      {route && (
        <UniversalMap origin={walk.origin} routes={[route]} selectedRouteIndex={0} height={260} />
      )}

      <View style={styles.stats}>
        <View style={styles.statCell}>
          <Route size={18} color={COLORS.primary} />
          <Text style={styles.statValue}>{formatDistance(walk.distanceMeters)}</Text>
          <Text style={styles.statLabel}>distance</Text>
        </View>
        <View style={styles.statCell}>
          <Timer size={18} color={COLORS.primary} />
          <Text style={styles.statValue}>{formatDuration(walk.durationSeconds)}</Text>
          <Text style={styles.statLabel}>time</Text>
        </View>
        <View style={styles.statCell}>
          <Footprints size={18} color={COLORS.primary} />
          <Text style={styles.statValue}>{walk.steps.toLocaleString()}</Text>
          <Text style={styles.statLabel}>steps</Text>
        </View>
      </View>

      {walk.pending && (
        <Text style={styles.pending}>Saved on this phone, not synced to your account yet.</Text>
      )}

      <TouchableOpacity style={styles.deleteButton} onPress={confirmDelete} activeOpacity={0.85}>
        <Trash2 size={16} color={COLORS.urgent} />
        <Text style={styles.deleteText}>Delete walk</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  missing: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  date: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: -8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stats: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  pending: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.urgent,
  },
});
