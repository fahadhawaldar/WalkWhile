import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { syncPendingWalks } from '../src/history/walkHistory';
import { COLORS } from '../src/theme/colors';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  // Signs in (anonymously on first launch) and uploads walks finished offline.
  useEffect(() => {
    syncPendingWalks().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: COLORS.surface,
            },
            headerTintColor: COLORS.primary,
            headerTitleStyle: {
              fontWeight: '700',
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: COLORS.background,
            },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'WalkWhile',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="routes"
            options={{
              title: 'Suggested Routes',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="preview"
            options={{
              title: 'Route Preview',
              headerBackTitle: 'Routes',
            }}
          />
          <Stack.Screen
            name="active"
            options={{
              title: 'Active Walk',
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="history"
            options={{
              title: 'Your Walks',
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="walk/[id]"
            options={{
              title: 'Walk',
              headerBackTitle: 'History',
            }}
          />
          <Stack.Screen
            name="summary"
            options={{
              title: 'Walk Summary',
              headerShown: false,
              gestureEnabled: false,
            }}
          />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
