import { StyleSheet, Text, View } from 'react-native';
import { RouteStep } from '@walkwhile/shared';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Flag,
  Navigation,
  RotateCcw,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { formatDistance } from '../utils/location';

interface TurnInstructionCardProps {
  step?: RouteStep;
  nextStep?: RouteStep;
  totalDistanceMeters?: number;
  walkedDistanceMeters?: number;
  stepCount?: number;
}

export const TurnInstructionCard: React.FC<TurnInstructionCardProps> = ({
  step,
  nextStep,
  totalDistanceMeters,
  walkedDistanceMeters,
  stepCount,
}) => {
  if (!step) {
    return (
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Navigation size={22} color="#FFFFFF" />
        </View>
        <View style={styles.content}>
          <Text style={styles.primaryInstruction}>
            Follow pedestrian pathway
          </Text>
          <Text style={styles.subInstruction}>
            Enjoy your walk and return on time
          </Text>
        </View>
      </View>
    );
  }

  const getStepIcon = (instruction: string) => {
    const lower = instruction.toLowerCase();
    if (lower.includes('left')) {
      return <ArrowLeft size={22} color="#FFFFFF" />;
    }
    if (lower.includes('right')) {
      return <ArrowRight size={22} color="#FFFFFF" />;
    }
    if (lower.includes('turn around') || lower.includes('back')) {
      return <RotateCcw size={22} color="#FFFFFF" />;
    }
    if (lower.includes('arrive') || lower.includes('starting point')) {
      return <Flag size={22} color="#FFFFFF" />;
    }
    return <ArrowUp size={22} color="#FFFFFF" />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.mainRow}>
        <View style={styles.iconCircle}>{getStepIcon(step.instruction)}</View>

        <View style={styles.content}>
          <Text style={styles.distanceText}>
            {formatDistance(step.distanceMeters)}
          </Text>
          <Text style={styles.primaryInstruction} numberOfLines={2}>
            {step.instruction}
          </Text>
        </View>
      </View>

      {nextStep ? (
        <View style={styles.nextRow}>
          <Text style={styles.nextLabel}>THEN:</Text>
          <Text style={styles.nextText} numberOfLines={1}>
            {nextStep.instruction}
          </Text>
        </View>
      ) : null}

      {totalDistanceMeters !== undefined && walkedDistanceMeters !== undefined ? (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(
                    100,
                    Math.round(
                      (walkedDistanceMeters / Math.max(1, totalDistanceMeters)) *
                        100
                    )
                  )}%`,
                },
              ]}
            />
          </View>
          <View style={styles.progressLabels}>
            <Text style={styles.progressText}>
              {formatDistance(walkedDistanceMeters)} walked
              {stepCount ? ` · ${stepCount.toLocaleString()} steps` : ''}
            </Text>
            <Text style={styles.progressText}>
              {formatDistance(totalDistanceMeters)} total
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.accent,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  primaryInstruction: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  subInstruction: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  nextLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    marginRight: 6,
    letterSpacing: 0.5,
  },
  nextText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    flex: 1,
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});
