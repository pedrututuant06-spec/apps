import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { cores } from '../lib/theme';

export default function RootLayout() {
  return (
    <>
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
    </>
  );
}
