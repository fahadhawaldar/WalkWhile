import { StyleSheet, Text, View } from 'react-native';
import { ReturnRouteStatus } from '@walkwhile/shared';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

interface WalkStatusBarProps {
  remainingSeconds: number;
  status: ReturnRouteStatus;
  message: string;
}

const STATUS_CONFIG: Record<
  ReturnRouteStatus,
  { label: string; tint: string; background: string; Icon: typeof Clock }
> = {
  safe: { label: 'On schedule', tint: COLORS.safe, background: COLORS.surface, Icon: CheckCircle },
  warning: { label: 'Head back now', tint: '#D97706', background: '#FFFBEB', Icon: Clock },
  urgent: { label: 'Cutting it close', tint: COLORS.urgent, background: '#FEF2F2', Icon: AlertTriangle },
  overdue: { label: 'Overdue', tint: COLORS.overdue, background: '#FEE2E2', Icon: AlertTriangle },
};

/**
 * Compact bar floating over the walk map: time left plus return status.
 * The full status message only shows once the walker needs to act.
 */
export const WalkStatusBar: React.FC<WalkStatusBarProps> = ({
  remainingSeconds,
  status,
  message,
}) => {
  const { label, tint, background, Icon } = STATUS_CONFIG[status] ?? STATUS_CONFIG.safe;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const time = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <View style={[styles.bar, { backgroundColor: background, borderColor: tint }]}>
      <View style={styles.row}>
        <Icon size={18} color={tint} strokeWidth={2.5} />
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
        <Text style={[styles.time, { color: status === 'safe' ? COLORS.primary : tint }]}>
          {time}
        </Text>
      </View>
      {status !== 'safe' && !!message && (
        <Text style={[styles.message, { color: tint }]}>{message}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  time: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  message: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
