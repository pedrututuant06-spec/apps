import { useState, type ReactNode } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cores } from '../lib/theme';

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={styles.secao}>
      <View style={styles.secaoCabecalho}>
        <View style={styles.secaoMarca} />
        <Text style={styles.secaoTitulo}>{titulo}</Text>
      </View>
      <View style={styles.secaoCorpo}>{children}</View>
    </View>
  );
}

/** Coloca campos lado a lado; cada filho recebe a largura proporcional ao seu `flex`. */
export function Linha({ children }: { children: ReactNode }) {
  return <View style={styles.linha}>{children}</View>;
}

type CampoTextoProps = TextInputProps & {
  rotulo: string;
  erro?: string;
  flex?: number;
  obrigatorio?: boolean;
  acessorio?: ReactNode;
};

export function CampoTexto({ rotulo, erro, flex = 1, obrigatorio, acessorio, style, ...props }: CampoTextoProps) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={[styles.campo, { flex }]}>
      <Text style={styles.rotulo}>
        {rotulo}
        {obrigatorio ? <Text style={{ color: cores.erro }}> *</Text> : null}
      </Text>
      <View style={[styles.entradaWrap, foco && styles.entradaFoco, !!erro && styles.entradaErro]}>
        <TextInput
          placeholderTextColor={cores.textoSuave}
          {...props}
          onFocus={(e) => {
            setFoco(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFoco(false);
            props.onBlur?.(e);
          }}
          style={[styles.entrada, props.multiline && styles.entradaMultilinha, style]}
        />
        {acessorio}
      </View>
      {erro ? <Text style={styles.erro}>{erro}</Text> : null}
    </View>
  );
}

type CampoSelecaoProps = {
  rotulo: string;
  valor: string;
  opcoes: string[];
  onChange: (v: string) => void;
  flex?: number;
  permitirOutro?: boolean;
  placeholder?: string;
};

export function CampoSelecao({
  rotulo,
  valor,
  opcoes,
  onChange,
  flex = 1,
  permitirOutro = true,
  placeholder = 'Selecione',
}: CampoSelecaoProps) {
  const [aberto, setAberto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const insets = useSafeAreaInsets();

  const filtradas = opcoes.filter((o) => o.toLowerCase().includes(filtro.trim().toLowerCase()));
  const podeUsarTexto =
    permitirOutro && filtro.trim() !== '' && !opcoes.some((o) => o.toLowerCase() === filtro.trim().toLowerCase());

  const escolher = (v: string) => {
    onChange(v);
    setAberto(false);
    setFiltro('');
  };

  return (
    <View style={[styles.campo, { flex }]}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${rotulo}: ${valor || placeholder}`}
        onPress={() => setAberto(true)}
        style={({ pressed }) => [styles.entradaWrap, pressed && { opacity: 0.7 }]}
      >
        <Text style={[styles.entrada, styles.selecaoTexto, !valor && { color: cores.textoSuave }]} numberOfLines={1}>
          {valor || placeholder}
        </Text>
        <Text style={styles.seta}>▾</Text>
      </Pressable>

      <Modal visible={aberto} animationType="slide" transparent onRequestClose={() => setAberto(false)}>
        <Pressable style={styles.modalFundo} onPress={() => setAberto(false)} />
        <View style={[styles.modalFolha, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.modalCabecalho}>
            <Text style={styles.modalTitulo}>{rotulo}</Text>
            <Pressable onPress={() => setAberto(false)} hitSlop={12}>
              <Text style={styles.modalFechar}>Fechar</Text>
            </Pressable>
          </View>
          {(opcoes.length > 8 || permitirOutro) && (
            <TextInput
              value={filtro}
              onChangeText={setFiltro}
              placeholder={permitirOutro ? 'Buscar ou digitar outro…' : 'Buscar…'}
              placeholderTextColor={cores.textoSuave}
              style={styles.modalBusca}
              autoCorrect={false}
            />
          )}
          <FlatList
            data={filtradas}
            keyExtractor={(i) => i}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                {podeUsarTexto && (
                  <Pressable style={styles.opcao} onPress={() => escolher(filtro.trim())}>
                    <Text style={[styles.opcaoTexto, { color: cores.primariaClara }]}>Usar “{filtro.trim()}”</Text>
                  </Pressable>
                )}
                {valor !== '' && (
                  <Pressable style={styles.opcao} onPress={() => escolher('')}>
                    <Text style={[styles.opcaoTexto, { color: cores.textoSuave }]}>Limpar seleção</Text>
                  </Pressable>
                )}
              </>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.opcao, pressed && { backgroundColor: cores.fundo }]}
                onPress={() => escolher(item)}
              >
                <Text style={[styles.opcaoTexto, item === valor && styles.opcaoSelecionada]}>{item}</Text>
                {item === valor && <Text style={styles.check}>✓</Text>}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  secao: {
    backgroundColor: cores.superficie,
    borderRadius: 12,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
    overflow: 'hidden',
  },
  secaoCabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#EEF0F5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  secaoMarca: { width: 4, height: 16, borderRadius: 2, backgroundColor: cores.destaque, marginRight: 8 },
  secaoTitulo: { fontSize: 13, fontWeight: '700', color: cores.primaria, letterSpacing: 0.6, textTransform: 'uppercase' },
  secaoCorpo: { padding: 14, paddingBottom: 4 },
  linha: { flexDirection: 'row', gap: 10 },
  campo: { marginBottom: 12, minWidth: 0 },
  rotulo: { fontSize: 12, fontWeight: '600', color: cores.textoSuave, marginBottom: 4 },
  entradaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    backgroundColor: '#FAFBFC',
    minHeight: 44,
  },
  entradaFoco: { borderColor: cores.primariaClara, backgroundColor: cores.superficie },
  entradaErro: { borderColor: cores.erro },
  entrada: {
    flex: 1,
    // Sem isto, no navegador o <input> tem largura mínima própria e empurra o formulário para o lado.
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: cores.texto,
    // A borda do campo já indica o foco; tira o contorno preto do navegador.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  entradaMultilinha: { minHeight: 90, textAlignVertical: 'top' },
  selecaoTexto: { paddingVertical: 12 },
  seta: { paddingRight: 10, color: cores.textoSuave, fontSize: 14 },
  erro: { color: cores.erro, fontSize: 12, marginTop: 3 },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  modalFolha: {
    maxHeight: '70%',
    backgroundColor: cores.superficie,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalCabecalho: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  modalTitulo: { fontSize: 17, fontWeight: '700', color: cores.primaria },
  modalFechar: { fontSize: 15, color: cores.primariaClara, fontWeight: '600' },
  modalBusca: {
    margin: 12,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    color: cores.texto,
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECEEF2',
  },
  opcaoTexto: { flex: 1, fontSize: 16, color: cores.texto },
  opcaoSelecionada: { fontWeight: '700', color: cores.primaria },
  check: { color: cores.destaque, fontSize: 18, fontWeight: '700' },
});
