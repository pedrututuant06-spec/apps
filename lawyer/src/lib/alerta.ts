import { Alert, Platform } from 'react-native';

// Alert.alert não faz nada no navegador; lá usamos window.alert / window.confirm.

export function avisar(titulo: string, mensagem: string) {
  if (Platform.OS === 'web') window.alert(`${titulo}\n\n${mensagem}`);
  else Alert.alert(titulo, mensagem);
}

export function confirmar(titulo: string, mensagem: string, textoAcao: string, aoConfirmar: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
    return;
  }
  Alert.alert(titulo, mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: textoAcao, style: 'destructive', onPress: aoConfirmar },
  ]);
}
