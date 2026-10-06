// Armazenamento no celular (iOS/Android): SQLite. A versão web fica em db.web.ts.
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { CAMPOS, type Cliente, type ClienteDados } from './cliente';

let conexao: Promise<SQLiteDatabase> | undefined;

function abrir() {
  conexao ??= (async () => {
    const db = await openDatabaseAsync('lawyer.db');
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
    return db;
  })();
  return conexao;
}

export async function listarClientes(busca: string, tipo?: string) {
  const db = await abrir();
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

export async function buscarCliente(id: number) {
  const db = await abrir();
  return db.getFirstAsync<Cliente>('SELECT * FROM clientes WHERE id = ?', [id]);
}

export async function salvarCliente(dados: ClienteDados, id?: number) {
  const db = await abrir();
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

export async function excluirCliente(id: number) {
  const db = await abrir();
  await db.runAsync('DELETE FROM clientes WHERE id = ?', [id]);
}

export async function excluirClientes(ids: number[]) {
  if (ids.length === 0) return;
  const db = await abrir();
  await db.runAsync(`DELETE FROM clientes WHERE id IN (${ids.map(() => '?').join(', ')})`, ids);
}
