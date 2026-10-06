import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CampoSelecao, CampoTexto, Linha, Secao } from '../../components/Campos';
import { avisar, confirmar } from '../../lib/alerta';
import { clienteVazio, type Campo, type ClienteDados } from '../../lib/cliente';
import { buscarCliente, excluirCliente, salvarCliente } from '../../lib/db';
import { isValidCPF, isValidDate, isValidEmail, maskCEP, maskCPF, maskDate, maskPhone, onlyDigits } from '../../lib/masks';
import { ESTADOS_CIVIS, GRUPOS, NACIONALIDADES, ORGAOS_EMISSORES, TIPOS, TRATAMENTOS, UFS } from '../../lib/options';
import { cores } from '../../lib/theme';

// Ao abrir um link direto no navegador não há tela anterior para voltar.
const voltar = () => (router.canGoBack() ? router.back() : router.replace('/'));

type Erros = Partial<Record<Campo, string>>;

function validar(d: ClienteDados): Erros {
  const e: Erros = {};
  if (!d.nome.trim()) e.nome = 'Informe o nome.';
  if (d.cpf && !isValidCPF(d.cpf)) e.cpf = 'CPF inválido.';
  if (d.data_nascimento && !isValidDate(d.data_nascimento)) e.data_nascimento = 'Data inválida (dd/mm/aaaa).';
  if (d.email && !isValidEmail(d.email)) e.email = 'E-mail inválido.';
  if (d.cep && onlyDigits(d.cep).length !== 8) e.cep = 'CEP deve ter 8 dígitos.';
  return e;
}

export default function CadastroCliente() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const novo = id === 'novo';
  const idNum = novo ? undefined : Number(id);

  const [dados, setDados] = useState<ClienteDados>(clienteVazio);
  const [erros, setErros] = useState<Erros>({});
  const [carregando, setCarregando] = useState(!novo);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const ultimoCep = useRef('');

  useEffect(() => {
    if (!idNum) return;
    buscarCliente(idNum).then((c) => {
      if (c) {
        const { id: _id, criado_em: _c, atualizado_em: _a, ...resto } = c;
        setDados({ ...clienteVazio(), ...resto });
        ultimoCep.current = onlyDigits(c.cep);
      }
      setCarregando(false);
    });
  }, [idNum]);

  const set = (campo: Campo) => (valor: string) => {
    setDados((d) => ({ ...d, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  };

  async function preencherPorCep(cep: string) {
    const digitos = onlyDigits(cep);
    if (digitos.length !== 8 || digitos === ultimoCep.current) return;
    ultimoCep.current = digitos;
    setBuscandoCep(true);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const json = await resp.json();
      if (json.erro) {
        setErros((e) => ({ ...e, cep: 'CEP não encontrado.' }));
        return;
      }
      // Só preenche o que ainda está vazio, para não apagar o que o usuário digitou.
      setDados((d) => ({
        ...d,
        endereco: d.endereco || json.logradouro || '',
        bairro: d.bairro || json.bairro || '',
        cidade: d.cidade || json.localidade || '',
        uf: d.uf || json.uf || '',
      }));
    } catch {
      // Sem internet: o usuário preenche manualmente.
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvar() {
    const e = validar(dados);
    setErros(e);
    if (Object.keys(e).length > 0) {
      avisar('Verifique os campos', Object.values(e).join('\n'));
      return;
    }
    setSalvando(true);
    try {
      await salvarCliente(dados, idNum);
      voltar();
    } catch (err) {
      avisar('Erro ao salvar', String(err));
    } finally {
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    if (!idNum) return;
    confirmar('Excluir cadastro', `Deseja excluir “${dados.nome}”? Essa ação não pode ser desfeita.`, 'Excluir', async () => {
      await excluirCliente(idNum);
      voltar();
    });
  }

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={cores.primaria} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen
        options={{
          title: novo ? 'Novo cadastro' : 'Editar cadastro',
          headerRight: () => (
            <Pressable onPress={salvar} disabled={salvando} hitSlop={10} style={styles.headerBotao}>
              <Text style={styles.headerSalvar}>Salvar</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.conteudo, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Secao titulo="Identificação">
          <CampoTexto
            rotulo="Nome"
            obrigatorio
            value={dados.nome}
            onChangeText={set('nome')}
            erro={erros.nome}
            autoCapitalize="words"
            placeholder="Nome completo"
          />
          <Linha>
            <CampoSelecao rotulo="Tratamento" valor={dados.tratamento} opcoes={TRATAMENTOS} onChange={set('tratamento')} />
            <CampoSelecao rotulo="Tipo" valor={dados.tipo} opcoes={TIPOS} onChange={set('tipo')} />
          </Linha>
          <CampoSelecao rotulo="Grupo" valor={dados.grupo} opcoes={GRUPOS} onChange={set('grupo')} />
        </Secao>

        <Secao titulo="Documentos">
          <CampoTexto
            rotulo="CPF"
            value={dados.cpf}
            onChangeText={(v) => set('cpf')(maskCPF(v))}
            erro={erros.cpf}
            keyboardType="number-pad"
            placeholder="000.000.000-00"
          />
          <Linha>
            <CampoTexto rotulo="RG" value={dados.rg} onChangeText={set('rg')} flex={3} autoCapitalize="characters" />
            <CampoSelecao rotulo="Órgão" valor={dados.orgao} opcoes={ORGAOS_EMISSORES} onChange={set('orgao')} flex={2} />
          </Linha>
          <CampoTexto
            rotulo="Data de nascimento"
            value={dados.data_nascimento}
            onChangeText={(v) => set('data_nascimento')(maskDate(v))}
            erro={erros.data_nascimento}
            keyboardType="number-pad"
            placeholder="dd/mm/aaaa"
          />
        </Secao>

        <Secao titulo="Contato">
          <Linha>
            <CampoTexto
              rotulo="Telefone"
              value={dados.telefone}
              onChangeText={(v) => set('telefone')(maskPhone(v))}
              keyboardType="phone-pad"
              placeholder="(00) 0000-0000"
            />
            <CampoTexto
              rotulo="Celular"
              value={dados.celular}
              onChangeText={(v) => set('celular')(maskPhone(v))}
              keyboardType="phone-pad"
              placeholder="(00) 00000-0000"
            />
          </Linha>
          <Linha>
            <CampoTexto
              rotulo="Telefone comercial"
              value={dados.telefone_comercial}
              onChangeText={(v) => set('telefone_comercial')(maskPhone(v))}
              keyboardType="phone-pad"
              placeholder="(00) 0000-0000"
            />
            <CampoTexto
              rotulo="Fax"
              value={dados.fax}
              onChangeText={(v) => set('fax')(maskPhone(v))}
              keyboardType="phone-pad"
              placeholder="(00) 0000-0000"
            />
          </Linha>
          <CampoTexto
            rotulo="E-mail"
            value={dados.email}
            onChangeText={set('email')}
            erro={erros.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="nome@exemplo.com"
          />
        </Secao>

        <Secao titulo="Qualificação">
          <Linha>
            <CampoSelecao rotulo="Nacionalidade" valor={dados.nacionalidade} opcoes={NACIONALIDADES} onChange={set('nacionalidade')} />
            <CampoSelecao rotulo="Estado civil" valor={dados.estado_civil} opcoes={ESTADOS_CIVIS} onChange={set('estado_civil')} />
          </Linha>
          <Linha>
            <CampoTexto rotulo="Profissão" value={dados.profissao} onChangeText={set('profissao')} autoCapitalize="sentences" />
            <CampoTexto rotulo="Local de trabalho" value={dados.local_trabalho} onChangeText={set('local_trabalho')} />
          </Linha>
          <CampoTexto
            rotulo="Qualificação — complemento"
            value={dados.qualificacao}
            onChangeText={set('qualificacao')}
            multiline
            placeholder="Informações adicionais da qualificação (ex.: portador da CNH nº…, inscrito na OAB…)"
          />
        </Secao>

        <Secao titulo="Endereço">
          <Linha>
            <CampoTexto
              rotulo="CEP"
              value={dados.cep}
              onChangeText={(v) => {
                const m = maskCEP(v);
                set('cep')(m);
                if (onlyDigits(m).length === 8) preencherPorCep(m);
              }}
              erro={erros.cep}
              keyboardType="number-pad"
              placeholder="00000-000"
              acessorio={buscandoCep ? <ActivityIndicator style={{ marginRight: 10 }} color={cores.primaria} /> : null}
            />
            <CampoSelecao rotulo="UF" valor={dados.uf} opcoes={UFS} onChange={set('uf')} permitirOutro={false} />
          </Linha>
          <CampoTexto rotulo="Endereço" value={dados.endereco} onChangeText={set('endereco')} placeholder="Rua, número, complemento" />
          <Linha>
            <CampoTexto rotulo="Bairro" value={dados.bairro} onChangeText={set('bairro')} />
            <CampoTexto rotulo="Cidade" value={dados.cidade} onChangeText={set('cidade')} />
          </Linha>
        </Secao>

        <Secao titulo="Anotações">
          <CampoTexto rotulo="Anotações" value={dados.anotacoes} onChangeText={set('anotacoes')} multiline placeholder="Observações gerais" />
        </Secao>

        <Pressable
          onPress={salvar}
          disabled={salvando}
          style={({ pressed }) => [styles.botaoSalvar, (pressed || salvando) && { opacity: 0.8 }]}
        >
          {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.botaoSalvarTexto}>Salvar cadastro</Text>}
        </Pressable>

        {!novo && (
          <Pressable onPress={confirmarExclusao} style={({ pressed }) => [styles.botaoExcluir, pressed && { opacity: 0.7 }]}>
            <Text style={styles.botaoExcluirTexto}>Excluir cadastro</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  // Em telas largas (navegador no computador) o formulário fica centralizado.
  conteudo: { padding: 14, width: '100%', maxWidth: 760, alignSelf: 'center' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // No navegador o cabeçalho não tem margem lateral própria.
  headerBotao: { paddingHorizontal: Platform.OS === 'web' ? 16 : 0 },
  headerSalvar: { color: cores.destaque, fontWeight: '800', fontSize: 16 },
  botaoSalvar: {
    backgroundColor: cores.primaria,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  botaoSalvarTexto: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  botaoExcluir: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: cores.perigo,
  },
  botaoExcluirTexto: { color: cores.perigo, fontWeight: '700', fontSize: 15 },
});
