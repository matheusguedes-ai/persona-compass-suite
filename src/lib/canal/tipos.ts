/**
 * A camada "canal de mensagem" (#291 F1a). Só declara o CONTRATO — quem fala com o fornecedor
 * (Zapster, hoje) é um adaptador que cumpre esta interface, isolado num arquivo só. Trocar de
 * fornecedor = escrever outro adaptador e trocá-lo em `adaptadorDoCanal`; nada mais muda.
 *
 * Agendamento, fila e histórico moram na plataforma (tabela `envios_mensagens`), nunca no
 * fornecedor: por isso o contrato só tem "enviar agora" e "a conexão está de pé?".
 */

export type Canal = "whatsapp" | "email";

export type ResultadoEnvioCanal =
  | { ok: true; idNoFornecedor: string | null }
  | { ok: false; motivo: string };

/** O que a tela pode saber da conexão. Nunca devolve id de instância, token nem resposta crua. */
export type EstadoDaConexao =
  | { estado: "conectada" }
  | { estado: "desconectada" }
  | { estado: "desligada" }
  | { estado: "nao_configurada" }
  | { estado: "indisponivel"; motivo: string };

export interface AdaptadorDeCanal {
  /** Nome gravado em `envios_mensagens.fornecedor`. */
  readonly fornecedor: string;
  /** O adaptador já tem o que precisa (variáveis de ambiente) para falar com o fornecedor? */
  configurado(): boolean;
  /** `destino` já vem PADRONIZADO (só dígitos, com o país). O adaptador não valida telefone. */
  enviarTexto(destino: string, texto: string): Promise<ResultadoEnvioCanal>;
  estadoDaConexao(): Promise<EstadoDaConexao>;
}
