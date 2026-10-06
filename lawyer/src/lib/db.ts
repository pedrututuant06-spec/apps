import type { SQLiteDatabase } from 'expo-sqlite';

export const CAMPOS = [
  'nome',
  'tratamento',
  'tipo',
  'grupo',
  'cpf',
  'rg',
  'orgao',
  'data_nascimento',
  'telefone',
  'telefone_comercial',
  'celular',
  'fax',
  'email',
  'local_trabalho',
  'profissao',
  'nacionalidade',
  'estado_civil',
  'qualificacao',
  'cep',
  'endereco',
  'bairro',
  'cidade',
  'uf',
  'anotacoes',
] as const;

export type Campo = (typeof CAMPOS)[number];
export type ClienteDados = Record<Campo, string>;
export type Cliente = ClienteDados & { id: number; criado_em: string; atualizado_em: string };

export const clienteVazio = (): ClienteDados =>
  Object.fromEntries(CAMPOS.map((c) => [c, ''])) as ClienteDados;

export async function migrate(db: SQLiteDatabase) {
  const colunas = CAMPOS.map((c) => `${c} TEXT NOT NULL DEFAULT ''`).join(',\n  ');
  await db.execAsync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ${colunas},
  criado_em TEXT NOT NULL DEFAULT (datetime('now')),
  atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_clientes_nome ON clientes (nome COLLATE NOCASE);
`);
}

export async function listarClientes(db: SQLiteDatabase, busca: string, tipo?: string) {
  const termo = `%${busca.trim()}%`;
  const digitos = busca.replace(/\D/g, '');
  const params: string[] = [termo, termo, termo];
  let where = `(nome LIKE ? COLLATE NOCASE OR email LIKE ? COLLATE NOCASE OR cidade LIKE ? COLLATE NOCASE`;
  if (digitos) {
    // CPF e telefones são guardados com máscara; compara só os dígitos.
    where += ` OR replace(replace(cpf, '.', ''), '-', '') LIKE ?`;
    where += ` OR replace(replace(replace(replace(celular, '(', ''), ')', ''), ' ', ''), '-', '') LIKE ?`;
    params.push(`%${digitos}%`, `%${digitos}%`);
  }
  where += ')';
  if (tipo) {
    where += ' AND tipo = ?';
    params.push(tipo);
  }
  return db.getAllAsync<Cliente>(`SELECT * FROM clientes WHERE ${where} ORDER BY nome COLLATE NOCASE`, params);
}

export function buscarCliente(db: SQLiteDatabase, id: number) {
  return db.getFirstAsync<Cliente>('SELECT * FROM clientes WHERE id = ?', [id]);
}

export async function salvarCliente(db: SQLiteDatabase, dados: ClienteDados, id?: number) {
  const valores = CAMPOS.map((c) => dados[c].trim());
  if (id) {
    const sets = CAMPOS.map((c) => `${c} = ?`).join(', ');
    await db.runAsync(`UPDATE clientes SET ${sets}, atualizado_em = datetime('now') WHERE id = ?`, [...valores, id]);
    return id;
  }
  const res = await db.runAsync(
    `INSERT INTO clientes (${CAMPOS.join(', ')}) VALUES (${CAMPOS.map(() => '?').join(', ')})`,
    valores,
  );
  return res.lastInsertRowId;
}

export async function excluirCliente(db: SQLiteDatabase, id: number) {
  await db.runAsync('DELETE FROM clientes WHERE id = ?', [id]);
}
