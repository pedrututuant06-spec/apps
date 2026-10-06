// Armazenamento no navegador: localStorage. A versão do celular fica em db.ts.
import { CAMPOS, type Cliente, type ClienteDados } from './cliente';

const CHAVE = 'lawyer.clientes';

function ler(): Cliente[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? '[]');
  } catch {
    return [];
  }
}

function gravar(lista: Cliente[]) {
  localStorage.setItem(CHAVE, JSON.stringify(lista));
}

const agora = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export async function listarClientes(busca: string, tipo?: string) {
  const termo = busca.trim().toLowerCase();
  const digitos = busca.replace(/\D/g, '');
  return ler()
    .filter((c) => !tipo || c.tipo === tipo)
    .filter(
      (c) =>
        !termo ||
        [c.nome, c.email, c.cidade].some((v) => v.toLowerCase().includes(termo)) ||
        (!!digitos && [c.cpf, c.celular].some((v) => v.replace(/\D/g, '').includes(digitos))),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
}

export async function buscarCliente(id: number) {
  return ler().find((c) => c.id === id) ?? null;
}

export async function salvarCliente(dados: ClienteDados, id?: number) {
  const lista = ler();
  const limpos = Object.fromEntries(CAMPOS.map((c) => [c, dados[c].trim()])) as ClienteDados;
  if (id) {
    gravar(lista.map((c) => (c.id === id ? { ...c, ...limpos, atualizado_em: agora() } : c)));
    return id;
  }
  const novoId = lista.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  gravar([...lista, { ...limpos, id: novoId, criado_em: agora(), atualizado_em: agora() }]);
  return novoId;
}

export async function excluirCliente(id: number) {
  gravar(ler().filter((c) => c.id !== id));
}
