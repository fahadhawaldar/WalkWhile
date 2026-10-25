import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Haptics never fail loudly: unsupported hardware or web just stays silent.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';
const quiet = () => {};

export const haptics = {
  /** A value stepped: picker, chip, segment, carousel page. */
  selection: () => {
    if (enabled) Haptics.selectionAsync().catch(quiet);
  },
  /** A primary action committed. */
  tap: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(quiet);
  },
  /** Something heavier landed: walk started or stopped. */
  thud: () => {
    if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(quiet);
  },
  success: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(quiet);
  },
  warning: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(quiet);
  },
  error: () => {
    if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(quiet);
  },
};
