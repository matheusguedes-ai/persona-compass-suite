/**
 * #313 — A árvore de pastas da Biblioteca, do lado da tela. Só FORMA (quem é filha de quem, em que
 * nível, qual o caminho): quem vê o quê nunca é decidido aqui — vem pronto do banco (`bib_decide`).
 *
 * O limite de 3 níveis também mora no banco (gatilho `bib_pasta_confere_arvore`); aqui ele só serve
 * para a tela não oferecer um destino que o banco vai recusar.
 */
import {
  FileText, FileSpreadsheet, Image as ImageIcon, Video, Music, Link as LinkIcon, Paperclip,
} from "lucide-react";
import { ORDEM_TIPOS } from "@/lib/biblioteca.functions";

export const MAX_NIVEIS = 3;

/**
 * Materiais agrupados por formato, na ordem fixa de ORDEM_TIPOS — pedido do dono desde a primeira
 * versão: os PDFs juntos, as planilhas juntas, as imagens juntas.
 */
export function agruparPorTipo<T extends { kind: string }>(materiais: T[]): Array<readonly [string, T[]]> {
  const por = new Map<string, T[]>();
  for (const m of materiais) {
    const k = (ORDEM_TIPOS as readonly string[]).includes(m.kind) ? m.kind : "outro";
    por.set(k, [...(por.get(k) ?? []), m]);
  }
  return ORDEM_TIPOS.filter((t) => por.has(t)).map((t) => [t, por.get(t)!] as const);
}

export type PastaNo = { id: string; titulo: string; pasta_mae_id: string | null; ordem: number; created_at: string };

export const ICONE_DO_TIPO = {
  pdf: FileText, planilha: FileSpreadsheet, imagem: ImageIcon, video: Video,
  audio: Music, link: LinkIcon, outro: Paperclip,
} as const;

export function iconeDoTipo(kind: string) {
  return ICONE_DO_TIPO[kind as keyof typeof ICONE_DO_TIPO] ?? Paperclip;
}

/** As filhas diretas de uma pasta (ou da raiz, com `maeId` nulo), na ordem da tela. */
export function filhasDe<T extends PastaNo>(pastas: T[], maeId: string | null): T[] {
  return pastas
    .filter((p) => (p.pasta_mae_id ?? null) === maeId)
    .sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

/** Da raiz até a pasta (inclusive). Pasta cuja mãe não está na lista começa o caminho ali. */
export function caminhoAte<T extends PastaNo>(pastas: T[], id: string | null): T[] {
  const porId = new Map(pastas.map((p) => [p.id, p]));
  const caminho: T[] = [];
  let atual = id ? porId.get(id) : undefined;
  const vistos = new Set<string>();
  while (atual && !vistos.has(atual.id)) {
    vistos.add(atual.id);
    caminho.unshift(atual);
    atual = atual.pasta_mae_id ? porId.get(atual.pasta_mae_id) : undefined;
  }
  return caminho;
}

/** Nível da pasta: 1 = no início da Biblioteca. */
export function nivelDe(pastas: PastaNo[], id: string): number {
  return caminhoAte(pastas, id).length;
}

/** A pasta e tudo o que está dentro dela, em qualquer profundidade. */
export function descendentesDe(pastas: PastaNo[], id: string): Set<string> {
  const saida = new Set<string>([id]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const p of pastas) {
      if (p.pasta_mae_id && saida.has(p.pasta_mae_id) && !saida.has(p.id)) {
        saida.add(p.id);
        mudou = true;
      }
    }
  }
  return saida;
}

/** Altura da pasta com o que tem dentro: 1 = sem subpastas. */
export function alturaDe(pastas: PastaNo[], id: string): number {
  const filhas = pastas.filter((p) => p.pasta_mae_id === id);
  return 1 + (filhas.length ? Math.max(...filhas.map((f) => alturaDe(pastas, f.id))) : 0);
}

/** Todas as pastas em ordem de árvore, com o nível — para listas de destino ("mover para…"). */
export function emOrdemDeArvore<T extends PastaNo>(pastas: T[]): Array<{ pasta: T; nivel: number }> {
  const saida: Array<{ pasta: T; nivel: number }> = [];
  const visitar = (maeId: string | null, nivel: number) => {
    for (const p of filhasDe(pastas, maeId)) {
      saida.push({ pasta: p, nivel });
      visitar(p.id, nivel + 1);
    }
  };
  visitar(null, 1);
  return saida;
}

/**
 * Abrir o link de um material sem cair no bloqueador de janelas do celular: a janela nasce NO clique
 * (síncrono) e recebe o endereço quando o servidor devolve — o link só é assinado depois de o banco
 * conferir o acesso de novo. Se o navegador não deixar abrir janela, abre na mesma aba.
 */
export async function abrirEmNovaAba(obterUrl: () => Promise<string>) {
  const janela = typeof window !== "undefined" ? window.open("", "_blank") : null;
  try {
    const url = await obterUrl();
    if (janela && !janela.closed) {
      janela.opener = null;
      janela.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (e) {
    janela?.close();
    throw e;
  }
}
