import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Schedules local "head back" and "time's up" alerts for a walk, so the
 * walker is warned even with the phone in their pocket. Replaces any alerts
 * from an earlier schedule.
 */
export async function scheduleWalkAlerts(params: {
  startTime: number;
  availableMinutes: number;
  safetyBufferMinutes: number;
}): Promise<void> {
  await cancelWalkAlerts();

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const { startTime, availableMinutes, safetyBufferMinutes } = params;
  const headBackAt = startTime + (availableMinutes - safetyBufferMinutes) * 60_000;
  const timeUpAt = startTime + availableMinutes * 60_000;

  const alerts = [
    {
      at: headBackAt,
      title: 'Head back now',
      body: `About ${safetyBufferMinutes} min left. Make your way back to your starting point.`,
    },
    {
      at: timeUpAt,
      title: "Time's up",
      body: 'Your waiting time is over.',
    },
  ];

  for (const alert of alerts) {
    if (alert.at <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: alert.title, body: alert.body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(alert.at),
      },
    });
  }
}

export async function cancelWalkAlerts(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
