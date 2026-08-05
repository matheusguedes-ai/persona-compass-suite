/**
 * Agenda de mentorias — visão de mês e visão de semana.
 *
 * Todo cálculo de data acontece AQUI, no navegador, e o período vai pronto para
 * o servidor. O servidor roda em UTC: se ele decidisse onde o mês (ou a
 * semana) começa, viraria três horas antes do Brasil e a sessão do último dia
 * às 22h sumiria da tela. Ver o comentário de `agendaDoMes` em
 * gestao.functions.ts — o servidor recebe `de`/`ate` como intervalo livre, não
 * fixa mês nem semana.
 *
 * Serve o master (`/agenda`) e o aluno (`/aluno/agenda`, `/aluno/mentorias`)
 * sem mudar nada: a RLS já recorta os dados de cada um.
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { agendaDoMes, excluirEvento, type Compromisso } from "@/lib/gestao.functions";
import { Button } from "@/components/ui/button";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, ExternalLink, Link2, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NovoEvento } from "@/components/novo-evento";

const SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Onde a escolha mês/semana fica salva — para não trocar toda vez que abre a tela. */
const CHAVE_VISAO = "agenda-visao";
type Visao = "mes" | "semana";

/** Faixa sugerida da grade de horas — expande se algum compromisso cair fora dela, nunca esconde. */
const HORA_MIN_PADRAO = 7;
const HORA_MAX_PADRAO = 21;
const ALTURA_HORA_PX = 48;

function mesmoDia(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function horaBr(iso: string): string | null {
  const d = new Date(iso);
  // Meia-noite em ponto quase sempre significa "sem hora definida", não 00:00.
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function horaFracionaria(iso: string): number {
  const d = new Date(iso);
  return d.getHours() + d.getMinutes() / 60;
}

/** Sem `termina_em` conhecido, um bloco de 1h — mesmo padrão de duração usada em outras telas. */
function duracaoHoras(c: Compromisso): number {
  if (c.termina_em) {
    const ms = new Date(c.termina_em).getTime() - new Date(c.quando).getTime();
    if (ms > 0) return Math.max(ms / 3_600_000, 0.25);
  }
  return 1;
}

function rotuloIntervaloSemana(inicio: Date, fimInclusive: Date): string {
  const mesmoMes = inicio.getMonth() === fimInclusive.getMonth() && inicio.getFullYear() === fimInclusive.getFullYear();
  if (mesmoMes) {
    const mes = inicio.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return `${inicio.getDate()} – ${fimInclusive.getDate()} de ${mes}`;
  }
  const ini = inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const fim = fimInclusive.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  return `${ini} – ${fim}`;
}

/**
 * Sobreposição: agrupa compromissos que se cruzam no tempo e divide a largura
 * da coluna entre eles — igual ao Google Calendar, nunca um em cima do outro.
 * Algoritmo guloso: dentro de um grupo, cada item entra na primeira coluna
 * livre (cuja última ocupação já terminou); o grupo todo divide a largura
 * pelo maior número de colunas usadas.
 */
function layoutSobreposicao(itens: { id: string; inicio: number; fim: number }[]) {
  const ordenados = [...itens].sort((a, b) => a.inicio - b.inicio);
  const resultado = new Map<string, { coluna: number; totalColunas: number }>();
  let grupo: typeof ordenados = [];
  let fimDoGrupo = -Infinity;

  const fecharGrupo = () => {
    if (grupo.length === 0) return;
    const fimDasColunas: number[] = [];
    for (const it of grupo) {
      let coluna = fimDasColunas.findIndex((fim) => it.inicio >= fim);
      if (coluna === -1) {
        coluna = fimDasColunas.length;
        fimDasColunas.push(it.fim);
      } else {
        fimDasColunas[coluna] = it.fim;
      }
      resultado.set(it.id, { coluna, totalColunas: 0 });
    }
    const totalColunas = fimDasColunas.length;
    for (const it of grupo) resultado.get(it.id)!.totalColunas = totalColunas;
    grupo = [];
  };

  for (const it of ordenados) {
    if (grupo.length && it.inicio >= fimDoGrupo) fecharGrupo();
    grupo.push(it);
    fimDoGrupo = Math.max(fimDoGrupo, it.fim);
  }
  fecharGrupo();

  return resultado;
}

function classesDoItem(c: Compromisso): string {
  if (c.tipo === "evento") return "bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300";
  if (c.status === "realizada") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (c.atrasada) return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
}

/**
 * `area` decide só para ONDE o compromisso leva — o mentor e o aluno vivem os
 * dois em /aluno, então ela não serve para decidir escopo.
 *
 * `somenteMinhas` é separado de propósito: o mentor pode acompanhar a agenda
 * do grupo dele; o aluno abre em `/aluno/mentorias` e precisa ver só o que é
 * dele. Amarrar as duas coisas na mesma prop deixaria o mentor com uma agenda
 * quase sempre vazia.
 */
export function Agenda({
  area = "dono",
  somenteMinhas = false,
  podeCriar = false,
  previewPersonId = null,
}: {
  area?: "dono" | "aluno";
  somenteMinhas?: boolean;
  /** Só o master cria evento — o mentor não publica novidade para os grupos. */
  podeCriar?: boolean;
  /** "Ver como aluno": de quem são "as minhas" sessões, quando somenteMinhas. */
  previewPersonId?: string | null;
}) {
  const hoje = new Date();
  // #269: o dia inicial é HOJE, não o dia 1 do mês — a visão de mês nunca lê
  // ref.getDate() (só ano/mês), mas a de semana calcula o domingo a partir
  // dele; com dia 1, um mês que comece no meio da semana abria em "semana"
  // já mostrando a semana passada para quem tinha essa visão salva.
  const [ref, setRef] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()));
  // Padrão estável (igual no servidor e no primeiro render do navegador) —
  // ler localStorage direto aqui causaria os dois discordarem e um aviso de
  // hydration mismatch. A escolha salva só chega depois, no efeito abaixo.
  const [modo, setModoEstado] = useState<Visao>("mes");
  useEffect(() => {
    const salvo = window.localStorage.getItem(CHAVE_VISAO);
    if (salvo === "mes" || salvo === "semana") setModoEstado(salvo);
  }, []);
  function mudarModo(v: Visao) {
    setModoEstado(v);
    window.localStorage.setItem(CHAVE_VISAO, v);
  }

  // O compromisso aberto no pop-up. Null = fechado.
  const [aberto, setAberto] = useState<Compromisso | null>(null);
  const [novoEventoAberto, setNovoEventoAberto] = useState(false);
  const qc = useQueryClient();
  const excluirFn = useServerFn(excluirEvento);
  const excluir = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Evento excluído.");
      qc.invalidateQueries({ queryKey: ["agenda"] });
      setAberto(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Domingo da semana de `ref` — mesma base usada pela grade e pelo intervalo.
  const domingoDaSemana = useMemo(
    () => new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ref.getDay()),
    [ref],
  );
  const diasDaSemana = useMemo(
    () => Array.from({ length: 7 }, (_, i) =>
      new Date(domingoDaSemana.getFullYear(), domingoDaSemana.getMonth(), domingoDaSemana.getDate() + i)),
    [domingoDaSemana],
  );

  // O intervalo consultado, em horário LOCAL, convertido para ISO com fuso.
  const { de, ate } = useMemo(() => {
    if (modo === "semana") {
      return {
        de: new Date(
          domingoDaSemana.getFullYear(), domingoDaSemana.getMonth(), domingoDaSemana.getDate(), 0, 0, 0,
        ).toISOString(),
        ate: new Date(
          domingoDaSemana.getFullYear(), domingoDaSemana.getMonth(), domingoDaSemana.getDate() + 7, 0, 0, 0,
        ).toISOString(),
      };
    }
    return {
      de: new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0).toISOString(),
      ate: new Date(ref.getFullYear(), ref.getMonth() + 1, 1, 0, 0, 0).toISOString(),
    };
  }, [ref, modo, domingoDaSemana]);

  const fn = useServerFn(agendaDoMes);
  const { data, isLoading } = useQuery({
    queryKey: ["agenda", de, ate, somenteMinhas, previewPersonId],
    queryFn: () => fn({ data: { de, ate, somenteMinhas, preview_person_id: previewPersonId } }),
  });

  const compromissos = data?.compromissos ?? [];

  // As células do calendário de MÊS: dias do mês, precedidos dos vazios até
  // cair no dia da semana certo.
  const celulas = useMemo(() => {
    const primeiro = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const diasNoMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
    const vazios = Array.from({ length: primeiro.getDay() }, () => null);
    const dias = Array.from(
      { length: diasNoMes },
      (_, i) => new Date(ref.getFullYear(), ref.getMonth(), i + 1),
    );
    return [...vazios, ...dias];
  }, [ref]);

  const doDia = (d: Date): Compromisso[] =>
    compromissos.filter((c) => mesmoDia(new Date(c.quando), d));

  // Faixa de horas da grade de SEMANA: 7h–21h por padrão, mas nunca esconde
  // compromisso — expande se algo cair antes das 7h ou depois das 21h. Item
  // sem horário definido (meia-noite em ponto) não entra nesta conta: ganha
  // uma faixa própria no topo de cada dia, em vez de esticar a grade inteira.
  const { horaMin, horaMax } = useMemo(() => {
    let min = HORA_MIN_PADRAO;
    let max = HORA_MAX_PADRAO;
    for (const c of compromissos) {
      if (horaBr(c.quando) === null) continue;
      const inicio = horaFracionaria(c.quando);
      const fim = inicio + duracaoHoras(c);
      if (inicio < min) min = Math.floor(inicio);
      if (fim > max) max = Math.ceil(fim);
    }
    return { horaMin: min, horaMax: max };
  }, [compromissos]);
  const totalHoras = horaMax - horaMin;
  const alturaGradePx = totalHoras * ALTURA_HORA_PX;
  const horasDoEixo = Array.from({ length: totalHoras + 1 }, (_, i) => horaMin + i);

  function itensDoDiaPosicionados(dia: Date) {
    const todos = doDia(dia);
    const semHorario = todos.filter((c) => horaBr(c.quando) === null);
    const comHorario = todos.filter((c) => horaBr(c.quando) !== null);
    const layout = layoutSobreposicao(
      comHorario.map((c) => {
        const inicio = horaFracionaria(c.quando);
        return { id: c.id, inicio, fim: inicio + duracaoHoras(c) };
      }),
    );
    const posicionados = comHorario.map((c) => {
      const inicio = horaFracionaria(c.quando);
      const fim = inicio + duracaoHoras(c);
      const info = layout.get(c.id)!;
      return {
        c,
        coluna: info.coluna,
        totalColunas: info.totalColunas,
        topPx: (inicio - horaMin) * ALTURA_HORA_PX,
        alturaPx: Math.max((fim - inicio) * ALTURA_HORA_PX, 20),
      };
    });
    return { posicionados, semHorario };
  }

  /** Link (mentoria) ou botão (evento) — mesma regra do mês: evento não é conversa com ninguém, não vira link. */
  function renderItem(c: Compromisso, className: string, style?: CSSProperties) {
    const rotulo = (
      <>
        {horaBr(c.quando) && <span className="font-medium tabular-nums">{horaBr(c.quando)} </span>}
        {c.person_name}
      </>
    );
    if (c.tipo === "evento") {
      return (
        <button key={c.id} onClick={() => setAberto(c)} className={className} style={style} title="Ver detalhes">
          {rotulo}
        </button>
      );
    }
    return (
      <Link
        key={c.id}
        to={area === "aluno" ? "/aluno/mentorias" : "/mentorias"}
        className={className}
        style={style}
        title={`${c.person_name}${horaBr(c.quando) ? ` · ${horaBr(c.quando)}` : ""}`}
      >
        {rotulo}
      </Link>
    );
  }

  const proximos = compromissos
    .filter((c) => new Date(c.quando).getTime() >= Date.now())
    .slice(0, 5);

  const rotulo = modo === "semana"
    ? rotuloIntervaloSemana(diasDaSemana[0], diasDaSemana[6])
    : ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  function irParaAnterior() {
    setRef(modo === "semana"
      ? new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 7)
      : new Date(ref.getFullYear(), ref.getMonth() - 1, 1));
  }
  function irParaProximo() {
    setRef(modo === "semana"
      ? new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + 7)
      : new Date(ref.getFullYear(), ref.getMonth() + 1, 1));
  }
  function irParaHoje() {
    setRef(modo === "semana"
      ? new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
      : new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={irParaAnterior} aria-label={modo === "semana" ? "Semana anterior" : "Mês anterior"}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="min-w-40 text-sm font-medium capitalize">{rotulo}</span>
        <Button variant="outline" size="sm" onClick={irParaProximo} aria-label={modo === "semana" ? "Próxima semana" : "Próximo mês"}>
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={irParaHoje}>
          Hoje
        </Button>

        <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
          <Button
            variant={modo === "mes" ? "default" : "ghost"} size="sm" className="h-7 px-2.5"
            onClick={() => mudarModo("mes")}
          >
            Mês
          </Button>
          <Button
            variant={modo === "semana" ? "default" : "ghost"} size="sm" className="h-7 px-2.5"
            onClick={() => mudarModo("semana")}
          >
            Semana
          </Button>
        </div>

        {isLoading && <span className="text-xs text-muted-foreground">carregando…</span>}
        {podeCriar && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="ml-auto">
                  <Plus className="size-4" /> Criar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setNovoEventoAberto(true)}>
                  <CalendarPlus className="size-4" />
                  <span>Criar evento</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/mentorias/agendamento">
                    <Link2 className="size-4" />
                    <span>Criar link de agendamento</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <NovoEvento open={novoEventoAberto} onOpenChange={setNovoEventoAberto} />
          </>
        )}
      </div>

      {modo === "mes" ? (
        <div className="overflow-x-auto">
          <div className="min-w-[42rem]">
            <div className="grid grid-cols-7 gap-1 pb-1">
              {SEMANA.map((d) => (
                <div key={d} className="px-1 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celulas.map((d, i) => {
                if (!d) return <div key={`v${i}`} />;
                const itens = doDia(d);
                const ehHoje = mesmoDia(d, hoje);
                return (
                  <div
                    key={d.toISOString()}
                    className={`min-h-20 rounded-lg p-1.5 ring-1 ${
                      ehHoje ? "bg-primary/5 ring-primary/40" : "bg-card ring-black/5"
                    }`}
                  >
                    <span
                      className={`text-xs tabular-nums ${
                        ehHoje ? "font-semibold text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <ul className="mt-1 space-y-1">
                      {itens.map((c) => (
                        <li key={c.id}>
                          {renderItem(c, `block w-full truncate rounded px-1.5 py-1 text-left text-[11px] leading-tight ${classesDoItem(c)}`)}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Grade com horas — só a partir de md. Sete colunas não cabem num celular. */}
          <div className="hidden overflow-x-auto md:block">
            <div className="min-w-[46rem]">
              <div className="grid" style={{ gridTemplateColumns: "3.25rem repeat(7, minmax(0,1fr))" }}>
                <div />
                {diasDaSemana.map((d) => {
                  const ehHoje = mesmoDia(d, hoje);
                  return (
                    <div
                      key={d.toISOString()}
                      className={`px-1 pb-1 text-center text-xs font-medium ${ehHoje ? "text-primary" : "text-muted-foreground"}`}
                    >
                      <div>{SEMANA[d.getDay()]}</div>
                      <div className={`tabular-nums ${ehHoje ? "font-semibold" : ""}`}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              <div className="max-h-[42rem] overflow-y-auto">
                <div className="grid" style={{ gridTemplateColumns: "3.25rem repeat(7, minmax(0,1fr))" }}>
                  <div className="relative" style={{ height: alturaGradePx }}>
                    {horasDoEixo.map((h) => (
                      <div
                        key={h}
                        className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                        style={{ top: (h - horaMin) * ALTURA_HORA_PX }}
                      >
                        {String(h).padStart(2, "0")}h
                      </div>
                    ))}
                  </div>
                  {diasDaSemana.map((d) => {
                    const { posicionados, semHorario } = itensDoDiaPosicionados(d);
                    const ehHoje = mesmoDia(d, hoje);
                    return (
                      <div
                        key={d.toISOString()}
                        className={`relative border-l border-black/5 ${ehHoje ? "bg-primary/5" : ""}`}
                        style={{
                          height: alturaGradePx,
                          backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${ALTURA_HORA_PX - 1}px, rgba(0,0,0,0.07) ${ALTURA_HORA_PX - 1}px, rgba(0,0,0,0.07) ${ALTURA_HORA_PX}px)`,
                        }}
                      >
                        {semHorario.length > 0 && (
                          <div className="absolute inset-x-0.5 top-0.5 z-10 space-y-0.5">
                            {semHorario.map((c) =>
                              renderItem(c, `block truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight ${classesDoItem(c)}`))}
                          </div>
                        )}
                        {posicionados.map(({ c, coluna, totalColunas, topPx, alturaPx }) =>
                          renderItem(
                            c,
                            `absolute overflow-hidden rounded px-1 py-0.5 text-left text-[10px] leading-tight ${classesDoItem(c)}`,
                            {
                              top: topPx,
                              height: alturaPx,
                              left: `calc(${(coluna * 100) / totalColunas}% + 1px)`,
                              width: `calc(${100 / totalColunas}% - 2px)`,
                            },
                          ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Celular: mesmos sete dias, em lista — sem grade, sem rolagem lateral. */}
          <div className="space-y-2 md:hidden">
            {diasDaSemana.map((d) => {
              const itens = [...doDia(d)].sort((a, b) => a.quando.localeCompare(b.quando));
              const ehHoje = mesmoDia(d, hoje);
              return (
                <div
                  key={d.toISOString()}
                  className={`rounded-lg p-2 ring-1 ${ehHoje ? "bg-primary/5 ring-primary/40" : "bg-card ring-black/5"}`}
                >
                  <div className={`text-xs font-medium capitalize ${ehHoje ? "text-primary" : "text-muted-foreground"}`}>
                    {SEMANA[d.getDay()]} · {d.getDate()}
                  </div>
                  {itens.length === 0 ? (
                    <p className="py-1 text-xs text-muted-foreground">Nada marcado.</p>
                  ) : (
                    <ul className="mt-1 space-y-1">
                      {itens.map((c) => (
                        <li key={c.id}>
                          {renderItem(c, `block w-full truncate rounded px-1.5 py-1 text-left text-[11px] leading-tight ${classesDoItem(c)}`)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Tudo do evento junto, num lugar só — era o que faltava: dava para
          criar com imagem e link e não havia onde vê-los. */}
      <Dialog open={!!aberto} onOpenChange={(v) => !v && setAberto(null)}>
        <DialogContent className="flex max-w-lg flex-col">
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle>{aberto.person_name}</DialogTitle>
              </DialogHeader>

              {aberto.imagem_url && (
                <img
                  src={aberto.imagem_url} alt=""
                  className="max-h-56 w-full rounded-lg object-cover"
                />
              )}

              <div className="flex items-start gap-2 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span>
                  {new Date(aberto.quando).toLocaleDateString("pt-BR", {
                    weekday: "long", day: "2-digit", month: "long",
                  })}
                  {horaBr(aberto.quando) && ` · ${horaBr(aberto.quando)}`}
                  {aberto.termina_em && horaBr(aberto.termina_em) && ` às ${horaBr(aberto.termina_em)}`}
                </span>
              </div>

              {aberto.descricao && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {aberto.descricao}
                </p>
              )}

              {aberto.link_url && (
                <a
                  href={aberto.link_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                >
                  <ExternalLink className="size-3.5" /> Abrir link
                </a>
              )}

              {/* Sem este aviso, apagar aqui pareceria não funcionar: o evento
                  volta no próximo salvamento da aula, que é a fonte dele. */}
              {aberto.de_aula && (
                <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                  Este encontro vem de uma <strong>aula do Classroom</strong>. Ele acompanha a aula:
                  mudar a data lá muda aqui, e apagar aqui não apaga a aula.
                </p>
              )}

              {/* Só quem cria pode excluir — a mesma condição do botão "Novo
                  evento". A RLS barra de verdade; isto evita oferecer o que a
                  pessoa não pode fazer. */}
              {podeCriar && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm"
                      className="mt-2 self-start text-destructive hover:text-destructive">
                      <Trash2 className="size-3.5" /> Excluir evento
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir "{aberto.person_name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O evento some da agenda de todas as pessoas que o receberam — e também
                        do seu Google Calendar, se estiver conectado. Não dá para desfazer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => excluir.mutate(aberto.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* O calendário mostra o mês ou a semana; esta lista responde "e agora, o que vem?" */}
      <div className="rounded-xl bg-card p-4 ring-1 ring-black/5">
        <h3 className="text-sm font-medium">Próximos</h3>
        {proximos.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nada marcado daqui para a frente {modo === "semana" ? "nesta semana" : "neste mês"}.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proximos.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                {c.tipo === "evento" ? (
                  <button onClick={() => setAberto(c)} className="truncate text-left hover:underline">
                    {c.person_name}
                  </button>
                ) : (
                  <span className="truncate">{c.person_name}</span>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(c.quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  {horaBr(c.quando) ? ` · ${horaBr(c.quando)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
