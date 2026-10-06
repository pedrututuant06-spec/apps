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
