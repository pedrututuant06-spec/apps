import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Cliente } from '../lib/cliente';
import { listarClientes } from '../lib/db';
import { TIPOS } from '../lib/options';
import { cores, coresTipo } from '../lib/theme';

function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

export default function ListaClientes() {
  const insets = useSafeAreaInsets();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<string | undefined>();
  const [clientes, setClientes] = useState<Cliente[]>([]);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      listarClientes(busca, tipo).then((r) => ativo && setClientes(r));
      return () => {
        ativo = false;
      };
    }, [busca, tipo]),
  );

  return (
    <View style={styles.tela}>
      <View style={styles.topo}>
        <View style={styles.buscaWrap}>
          <Text style={styles.buscaIcone}>⌕</Text>
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Buscar por nome, CPF, celular, cidade…"
            placeholderTextColor={cores.textoSuave}
            style={styles.busca}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtros}>
          {[undefined, ...TIPOS].map((t) => {
            const ativo = t === tipo;
            return (
              <Pressable
                key={t ?? 'todos'}
                onPress={() => setTipo(t)}
                style={[styles.chip, ativo && styles.chipAtivo]}
              >
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>{t ?? 'Todos'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={clientes}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + 96 }]}
        ListHeaderComponent={
          clientes.length > 0 ? (
            <Text style={styles.contagem}>
              {clientes.length} {clientes.length === 1 ? 'cadastro' : 'cadastros'}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.vazio}>
            <Text style={styles.vazioTitulo}>{busca || tipo ? 'Nenhum resultado' : 'Nenhum cadastro ainda'}</Text>
            <Text style={styles.vazioTexto}>
              {busca || tipo ? 'Tente outro termo de busca ou filtro.' : 'Toque em “+ Novo” para cadastrar a primeira pessoa.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const cor = coresTipo[item.tipo] ?? coresTipo.Outro;
          const contato = item.celular || item.telefone || item.email;
          const local = [item.cidade, item.uf].filter(Boolean).join(' / ');
          return (
            <Pressable
              onPress={() => router.push(`/cliente/${item.id}`)}
              style={({ pressed }) => [styles.cartao, pressed && { opacity: 0.75 }]}
            >
              <View style={[styles.avatar, { backgroundColor: cores.primaria }]}>
                <Text style={styles.avatarTexto}>{iniciais(item.nome)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.nome} numberOfLines={1}>
                  {item.tratamento ? `${item.tratamento} ` : ''}
                  {item.nome}
                </Text>
                {!!item.cpf && <Text style={styles.detalhe}>CPF {item.cpf}</Text>}
                {!!(contato || local) && (
                  <Text style={styles.detalhe} numberOfLines={1}>
                    {[contato, local].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                {!!item.tipo && (
                  <View style={[styles.etiqueta, { backgroundColor: cor + '1A', borderColor: cor }]}>
                    <Text style={[styles.etiquetaTexto, { color: cor }]}>{item.tipo}</Text>
                  </View>
                )}
                {!!item.grupo && <Text style={styles.grupo}>{item.grupo}</Text>}
              </View>
            </Pressable>
          );
        }}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Novo cadastro"
        onPress={() => router.push('/cliente/novo')}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.fabTexto}>+ Novo</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: { backgroundColor: cores.primaria, paddingHorizontal: 14, paddingBottom: 12 },
  conteudo: { padding: 14, width: '100%', maxWidth: 760, alignSelf: 'center' },
  buscaWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: cores.superficie,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  buscaIcone: { fontSize: 18, color: cores.textoSuave, marginRight: 6 },
  busca: { flex: 1, paddingVertical: 10, fontSize: 15, color: cores.texto },
  filtros: { gap: 8, paddingTop: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chipAtivo: { backgroundColor: cores.destaque, borderColor: cores.destaque },
  chipTexto: { color: '#E6E9F0', fontSize: 13, fontWeight: '600' },
  chipTextoAtivo: { color: '#FFFFFF' },
  contagem: { color: cores.textoSuave, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  cartao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: cores.superficie,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: cores.borda,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { color: cores.destaque, fontWeight: '800', fontSize: 16 },
  nome: { fontSize: 16, fontWeight: '700', color: cores.texto },
  detalhe: { fontSize: 13, color: cores.textoSuave, marginTop: 2 },
  etiqueta: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  etiquetaTexto: { fontSize: 11, fontWeight: '700' },
  grupo: { fontSize: 11, color: cores.textoSuave },
  vazio: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  vazioTitulo: { fontSize: 18, fontWeight: '700', color: cores.primaria, marginBottom: 6 },
  vazioTexto: { fontSize: 14, color: cores.textoSuave, textAlign: 'center' },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: cores.destaque,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabTexto: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
});
