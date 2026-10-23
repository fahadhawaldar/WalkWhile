import { StyleSheet, Text, View } from 'react-native';
import {
  RecommendedReturnAction,
  ReturnRouteStatus,
} from '@walkwhile/shared';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react-native';

interface ReturnAlertBannerProps {
  status: ReturnRouteStatus;
  action: RecommendedReturnAction;
  message: string;
  safetyMarginSeconds: number;
}

export const ReturnAlertBanner: React.FC<ReturnAlertBannerProps> = ({
  status,
  message,
}) => {
  const getBannerConfig = () => {
    switch (status) {
      case 'overdue':
        return {
          bgColor: '#FEE2E2',
          borderColor: '#EF4444',
          textColor: '#991B1B',
          icon: <AlertTriangle size={20} color="#DC2626" />,
          title: 'OVERDUE - RETURN IMMEDIATELY',
        };
      case 'urgent':
        return {
          bgColor: '#FEF2F2',
          borderColor: '#F87171',
          textColor: '#B91C1C',
          icon: <AlertTriangle size={20} color="#DC2626" />,
          title: 'CRITICAL BUFFER REACHED',
        };
      case 'warning':
        return {
          bgColor: '#FEF3C7',
          borderColor: '#F59E0B',
          textColor: '#92400E',
          icon: <Clock size={20} color="#D97706" />,
          title: 'SAFETY BUFFER ACTIVE - HEAD BACK',
        };
      case 'safe':
      default:
        return {
          bgColor: '#ECFDF5',
          borderColor: '#10B981',
          textColor: '#065F46',
          icon: <CheckCircle size={20} color="#059669" />,
          title: 'ON SCHEDULE',
        };
    }
  };

  const config = getBannerConfig();

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: config.bgColor, borderColor: config.borderColor },
      ]}
    >
      <View style={styles.iconContainer}>{config.icon}</View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: config.textColor }]}>
          {config.title}
        </Text>
        <Text style={[styles.message, { color: config.textColor }]}>
          {message}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginVertical: 8,
  },
  iconContainer: {
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
