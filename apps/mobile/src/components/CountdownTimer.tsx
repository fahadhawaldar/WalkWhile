import { StyleSheet, Text, View } from 'react-native';
import { ReturnRouteStatus } from '@walkwhile/shared';
import { COLORS } from '../theme/colors';

interface CountdownTimerProps {
  remainingSeconds: number;
  safetyStatus: ReturnRouteStatus;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  remainingSeconds,
  safetyStatus,
}) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;

  const getStatusColor = () => {
    switch (safetyStatus) {
      case 'overdue':
        return COLORS.overdue;
      case 'urgent':
        return COLORS.urgent;
      case 'warning':
        return COLORS.warning;
      case 'safe':
      default:
        return COLORS.primary;
    }
  };

  const statusColor = getStatusColor();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>TIME REMAINING</Text>
      <Text style={[styles.timerText, { color: statusColor }]}>
        {formattedTime}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.textMuted,
    marginBottom: 4,
  },
  timerText: {
    fontSize: 44,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
});
