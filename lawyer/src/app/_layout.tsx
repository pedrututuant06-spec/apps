import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrate } from '../lib/db';
import { cores } from '../lib/theme';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="lawyer.db" onInit={migrate}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.primaria },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: cores.fundo },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'lawyer' }} />
        <Stack.Screen name="cliente/[id]" options={{ title: 'Cadastro' }} />
      </Stack>
    </SQLiteProvider>
  );
}
