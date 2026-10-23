import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WalkingRoute } from '@walkwhile/shared';
import { Check, Repeat, Undo2 } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { formatDistance } from '../utils/location';

interface RouteCardProps {
  route: WalkingRoute;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  index,
  isSelected,
  onSelect,
}) => {
  const routeColor = COLORS.routeColors[index % COLORS.routeColors.length];
  const durationMinutes = Math.round(route.calibratedDurationSeconds / 60);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onSelect}
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        isSelected && { borderColor: routeColor },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.colorBadge, { backgroundColor: routeColor }]} />
          <Text style={styles.routeTitle}>Route {index + 1}</Text>
          <View
            style={[
              styles.typeBadge,
              route.type === 'loop' ? styles.loopBadge : styles.outAndBackBadge,
            ]}
          >
            {route.type === 'loop' ? (
              <Repeat size={12} color="#065F46" />
            ) : (
              <Undo2 size={12} color="#92400E" />
            )}
            <Text
              style={[
                styles.typeText,
                route.type === 'loop'
                  ? styles.loopText
                  : styles.outAndBackText,
              ]}
            >
              {route.type === 'loop' ? 'LOOP' : 'OUT & BACK'}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.radioCircle,
            isSelected && {
              backgroundColor: routeColor,
              borderColor: routeColor,
            },
          ]}
        >
          {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>DURATION</Text>
          <Text style={styles.metricValue}>~{durationMinutes} min</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>DISTANCE</Text>
          <Text style={styles.metricValue}>
            {formatDistance(route.distanceMeters)}
          </Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          {route.maxReturnSeconds !== undefined ? (
            <>
              <Text style={styles.metricLabel}>FURTHEST</Text>
              <Text style={styles.metricValue}>
                {Math.max(1, Math.ceil(route.maxReturnSeconds / 60))} min away
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.metricLabel}>STEPS</Text>
              <Text style={styles.metricValue}>
                {route.instructions?.length || 1} turns
              </Text>
            </>
          )}
        </View>
      </View>

      {route.summary ? (
        <Text style={styles.summaryText} numberOfLines={2}>
          {route.summary}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    marginVertical: 6,
    borderWidth: 2,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardSelected: {
    backgroundColor: '#FAFDFB',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  routeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginRight: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  loopBadge: {
    backgroundColor: '#D1FAE5',
  },
  outAndBackBadge: {
    backgroundColor: '#FEF3C7',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  loopText: {
    color: '#065F46',
  },
  outAndBackText: {
    color: '#92400E',
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.borderDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: COLORS.border,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: COLORS.textMuted,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  summaryText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
});
