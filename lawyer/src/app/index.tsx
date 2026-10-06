import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Cliente } from '../lib/cliente';
import { confirmar } from '../lib/alerta';
import { excluirClientes, listarClientes } from '../lib/db';
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
  // null = modo normal; um Set = modo de seleção para excluir vários.
  const [selecionados, setSelecionados] = useState<Set<number> | null>(null);
  const selecionando = selecionados !== null;

  const recarregar = useCallback(() => listarClientes(busca, tipo).then(setClientes), [busca, tipo]);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      listarClientes(busca, tipo).then((r) => ativo && setClientes(r));
      return () => {
        ativo = false;
      };
    }, [busca, tipo]),
  );

  function alternar(id: number) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function excluir(ids: number[], descricao: string) {
    confirmar('Excluir cadastro', `Deseja excluir ${descricao}? Essa ação não pode ser desfeita.`, 'Excluir', async () => {
      await excluirClientes(ids);
      setSelecionados(null);
      await recarregar();
    });
  }

  const todosSelecionados = selecionando && clientes.length > 0 && clientes.every((c) => selecionados.has(c.id));

  return (
    <View style={styles.tela}>
      <Stack.Screen
        options={{
          headerRight: () =>
            clientes.length > 0 || selecionando ? (
              <Pressable onPress={() => setSelecionados(selecionando ? null : new Set())} hitSlop={10} style={styles.headerBotao}>
                <Text style={styles.headerTexto}>{selecionando ? 'Cancelar' : 'Selecionar'}</Text>
              </Pressable>
            ) : null,
        }}
      />
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
            <View style={styles.cabecalhoLista}>
              <Text style={styles.contagem}>
                {selecionando
                  ? `${selecionados.size} de ${clientes.length} selecionados`
                  : `${clientes.length} ${clientes.length === 1 ? 'cadastro' : 'cadastros'}`}
              </Text>
              {selecionando && (
                <Pressable
                  onPress={() => setSelecionados(todosSelecionados ? new Set() : new Set(clientes.map((c) => c.id)))}
                  hitSlop={8}
                >
                  <Text style={styles.selecionarTodos}>{todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}</Text>
                </Pressable>
              )}
            </View>
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
          const marcado = selecionando && selecionados.has(item.id);
          return (
            <Pressable
              onPress={() => (selecionando ? alternar(item.id) : router.push(`/cliente/${item.id}`))}
              onLongPress={() => !selecionando && setSelecionados(new Set([item.id]))}
              style={({ pressed }) => [styles.cartao, marcado && styles.cartaoMarcado, pressed && { opacity: 0.75 }]}
            >
              {selecionando ? (
                <View style={[styles.caixa, marcado && styles.caixaMarcada]}>
                  {marcado && <Text style={styles.caixaCheck}>✓</Text>}
                </View>
              ) : (
                <View style={[styles.avatar, { backgroundColor: cores.primaria }]}>
                  <Text style={styles.avatarTexto}>{iniciais(item.nome)}</Text>
                </View>
              )}
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
              {!selecionando && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Excluir ${item.nome}`}
                  onPress={() => excluir([item.id], `“${item.nome}”`)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.lixeira, pressed && { backgroundColor: '#FDECEA' }]}
                >
                  <Text style={styles.lixeiraIcone}>🗑</Text>
                </Pressable>
              )}
            </Pressable>
          );
        }}
      />

      {selecionando ? (
        <View style={[styles.barraExcluir, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            disabled={selecionados.size === 0}
            onPress={() =>
              excluir(
                [...selecionados],
                selecionados.size === 1 ? '1 cadastro' : `${selecionados.size} cadastros`,
              )
            }
            style={({ pressed }) => [
              styles.botaoExcluir,
              selecionados.size === 0 && { opacity: 0.4 },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.botaoExcluirTexto}>
              {selecionados.size === 0 ? 'Toque nos cadastros para selecionar' : `Excluir ${selecionados.size} selecionado${selecionados.size > 1 ? 's' : ''}`}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Novo cadastro"
          onPress={() => router.push('/cliente/novo')}
          style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 20 }, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.fabTexto}>+ Novo</Text>
        </Pressable>
      )}
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
  contagem: { color: cores.textoSuave, fontSize: 12, fontWeight: '600' },
  cabecalhoLista: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  selecionarTodos: { color: cores.primariaClara, fontSize: 13, fontWeight: '700' },
  headerBotao: { paddingHorizontal: Platform.OS === 'web' ? 16 : 0 },
  headerTexto: { color: cores.destaque, fontWeight: '800', fontSize: 16 },
  cartaoMarcado: { borderColor: cores.perigo, backgroundColor: '#FFF6F5' },
  caixa: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 9,
  },
  caixaMarcada: { backgroundColor: cores.perigo, borderColor: cores.perigo },
  caixaCheck: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  lixeira: { padding: 8, borderRadius: 18 },
  lixeiraIcone: { fontSize: 18 },
  barraExcluir: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: cores.superficie,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
  },
  botaoExcluir: {
    backgroundColor: cores.perigo,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  botaoExcluirTexto: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
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
