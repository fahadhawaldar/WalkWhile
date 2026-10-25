import { useEffect } from 'react';
import { Appearance } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncPendingWalks } from '../src/history/walkHistory';
// Registers the background location task; it must exist before iOS delivers
// updates to a relaunched app.
import '../src/utils/backgroundLocation';
import { useWalkStore } from '../src/store/useWalkStore';
import { useColors } from '../src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const colors = useColors();
  const appearance = useWalkStore((s) => s.appearance);

  // Apply the in-app light/dark choice; 'system' follows the phone.
  useEffect(() => {
    Appearance.setColorScheme(appearance === 'system' ? null : appearance);
  }, [appearance]);

  // Signs in (anonymously on first launch) and uploads walks finished offline.
  useEffect(() => {
    syncPendingWalks().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.ink,
              headerTitleStyle: { fontWeight: '600' },
              headerShadowVisible: false,
              headerBackTitle: 'Back',
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="routes" options={{ headerShown: false }} />
            <Stack.Screen
              name="settings"
              options={{
                title: 'Walk settings',
                presentation: 'formSheet',
                sheetAllowedDetents: [0.6, 0.95],
                sheetGrabberVisible: true,
                sheetCornerRadius: 28,
                headerShown: false,
                contentStyle: { backgroundColor: colors.surface },
              }}
            />
            <Stack.Screen
              name="active"
              options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
            />
            <Stack.Screen
              name="summary"
              options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
            />
            <Stack.Screen
              name="history"
              options={{ title: 'Your walks', headerLargeTitle: true, headerBackTitle: 'Home' }}
            />
            <Stack.Screen name="walk/[id]" options={{ title: '', headerBackTitle: 'Walks' }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
