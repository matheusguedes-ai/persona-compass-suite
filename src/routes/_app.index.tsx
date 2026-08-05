import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/data.functions";
import { getMyMembership } from "@/lib/team.functions";
import {
  getPanoramaGeral, getResumoClassroom, getResumoAcademy, getResumoComunidade, getResumoEngajamento,
} from "@/lib/painel.functions";
import { Avatar } from "@/components/avatar-upload";
import {
  FolderKanban, Users, MessagesSquare, BookOpen, UsersRound, Trophy, ArrowRight, Presentation, UserX,
} from "lucide-react";

/**
 * O mentor afiliado não tem dashboard próprio: o do dono mostraria números da
 * conta inteira, que não são dele. Vai direto para Grupos, que é o trabalho
 * dele na plataforma.
 */
function RedirecionaMentor({ children }: { children: React.ReactNode }) {
  const membershipFn = useServerFn(getMyMembership);
  const { data } = useQuery({
    queryKey: ["my-membership"], queryFn: () => membershipFn(), staleTime: 300_000,
  });
  // O painel do mentor é o do ALUNO, com Grupos a mais — ele é um avaliado
  // promovido. O dashboard do dono mostraria números da conta que não são dele.
  if (data?.kind === "mentor") return <Navigate to="/aluno" search={{ ver: undefined }} />;
  return <>{children}</>;
}

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Métrica Humana" },
      { name: "description", content: "Resumo da plataforma: testes, Classroom, Academy, comunidade e quem está sumindo." },
      { property: "og:title", content: "Dashboard — Métrica Humana" },
      { property: "og:description", content: "Resumo da plataforma: testes, Classroom, Academy, comunidade e quem está sumindo." },
    ],
  }),
  component: () => (
    <RedirecionaMentor>
      <Dashboard />
    </RedirecionaMentor>
  ),
});

function Dashboard() {
  const membershipFn = useServerFn(getMyMembership);
  const { data: membership } = useQuery({
    queryKey: ["my-membership"], queryFn: () => membershipFn(), staleTime: 300_000,
  });
  const souDono = (membership?.kind ?? "owner") === "owner";
  const minhasPermissoes = membership?.permissions ?? [];
  // Testes e Envios são o mesmo assunto em dois momentos (mesma regra do menu
  // lateral) — qualquer uma das duas já libera o bloco.
  const podeTestes = souDono || minhasPermissoes.includes("testes") || minhasPermissoes.includes("envios");

  const statsFn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => statsFn(),
    // Sem a permissão, nem chama — a função recusaria mesmo assim, mas não há
    // por que gastar a chamada nem arriscar um erro visível na tela de quem
    // não tem nada a ver com Testes/Envios.
    enabled: podeTestes,
  });

  const total = data?.total ?? 0;
  const submitted = data?.submitted ?? 0;
  const pending = data?.pending ?? 0;
  const conversion = total > 0 ? Math.round((submitted / total) * 100) : 0;
  const byMonth = data?.byMonth ?? [];
  const byInstrument = data?.byInstrument ?? [];
  const recent = data?.recent ?? [];

  const mesPico = Math.max(1, ...byMonth.map((m) => m.respondidos));
  const instrPico = Math.max(1, ...byInstrument.map((i) => i.respondidos + i.pendentes));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          O resumo da plataforma — cada área que você pode abrir, num lugar só.
        </p>
      </div>

      {podeTestes && (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Testes enviados" value={isLoading ? "…" : String(total)} hint="Inclui os testes de cada bateria" />
            <KpiCard
              label="Respondidos"
              value={isLoading ? "…" : String(submitted)}
              hint={total > 0 ? `${conversion}% de conversão` : "Nenhum envio ainda"}
            />
            <KpiCard label="Pendentes" value={isLoading ? "…" : String(pending)} hintTone={pending > 0 ? "warn" : undefined} />
            <KpiCard label="Pessoas cadastradas" value={isLoading ? "…" : String(data?.people ?? 0)} />
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {/* Ritmo: mostra se o movimento está crescendo ou parou. */}
            <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
              <h2 className="text-sm font-medium tracking-tight">Testes respondidos por mês</h2>
              <p className="text-xs text-muted-foreground">Últimos 6 meses</p>
              {submitted === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {isLoading ? "Carregando…" : "Aparece aqui quando o primeiro teste for concluído."}
                </p>
              ) : (
                <div className="mt-5 flex h-36 items-end gap-2">
                  {byMonth.map((m) => (
                    <div key={m.chave} className="flex flex-1 flex-col items-center gap-1.5">
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        {m.respondidos > 0 ? m.respondidos : ""}
                      </span>
                      <div
                        className="w-full rounded-t bg-primary/80"
                        style={{ height: `${Math.max(m.respondidos > 0 ? 4 : 2, (m.respondidos / mesPico) * 100)}%` }}
                        title={`${m.respondidos} em ${m.mes}`}
                      />
                      <span className="text-xs capitalize text-muted-foreground">{m.mes}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quais inventários estão de fato sendo usados. */}
            <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
              <h2 className="text-sm font-medium tracking-tight">Inventários aplicados</h2>
              <p className="text-xs text-muted-foreground">Respondidos e pendentes por teste</p>
              {byInstrument.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {isLoading ? "Carregando…" : "Nenhum teste enviado ainda."}
                </p>
              ) : (
                <div className="mt-5 space-y-3">
                  {byInstrument.map((inst) => (
                    <div key={inst.name}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="font-medium">{inst.name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {inst.respondidos} respondido{inst.respondidos === 1 ? "" : "s"}
                          {inst.pendentes > 0 && ` · ${inst.pendentes} pendente${inst.pendentes === 1 ? "" : "s"}`}
                        </span>
                      </div>
                      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-muted">
                        <div className="bg-primary" style={{ width: `${(inst.respondidos / instrPico) * 100}%` }} />
                        <div className="bg-amber-400/70" style={{ width: `${(inst.pendentes / instrPico) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl bg-card p-6 ring-1 ring-black/5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-medium tracking-tight">Disparo rápido</h2>
                <p className="text-xs text-muted-foreground">Crie um novo envio para um avaliado.</p>
              </div>
              <Link to="/envios/novo" search={{ personId: undefined, groupId: undefined }} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                Novo envio
              </Link>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-medium tracking-tight">Atividade recente</h2>
              <Link to="/envios" className="text-xs font-medium text-accent hover:underline">Ver todos</Link>
            </div>
            <div className="overflow-hidden rounded-xl bg-card ring-1 ring-black/5">
              {recent.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {isLoading ? "Carregando…" : "Nenhum envio ainda. Crie o primeiro em Envios."}
                </p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-black/5 bg-muted/50">
                    <tr>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Avaliado</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Teste</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-6 py-3 font-medium text-muted-foreground">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {recent.map((s) => (
                      <tr key={s.id}>
                        <td className="px-6 py-4 font-medium">{s.nome}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {s.teste}
                          {s.emBateria && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                              bateria
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4"><StatusBadge status={s.concluido ? "concluido" : "pendente"} /></td>
                        <td className="px-6 py-4 text-muted-foreground">{new Date(s.quando).toLocaleDateString("pt-BR")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}

      <Panorama souDono={souDono} minhasPermissoes={minhasPermissoes} />
    </div>
  );
}

function horaBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

/** "8 de 10 (80%)" — número que precisa de contexto vem com o contexto, nunca sozinho. */
function fracaoComPct(presentes: number, total: number): string {
  if (total === 0) return "sem registro";
  const pct = Math.round((presentes / total) * 100);
  return `${presentes} de ${total} (${pct}%)`;
}

/**
 * Classroom no Dashboard — só o dono, mesma regra de app-sidebar.tsx
 * (`soDono: true`): Classroom é "menu do master", independente de qualquer
 * permissão de colaborador, `educacao` incluída (essa é de Academy).
 */
function CardClassroom({ souDono }: { souDono: boolean }) {
  const fn = useServerFn(getResumoClassroom);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["resumo-classroom"], queryFn: () => fn(), enabled: souDono,
  });
  if (!souDono || isError) return null;

  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        <Presentation className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium tracking-tight">Classroom</h2>
      </div>
      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm">
          <li>
            {data?.proxima
              ? <>Próxima aula: <strong>{data.proxima.titulo}</strong>, {horaBr(data.proxima.comeca_em!)}.</>
              : <span className="text-muted-foreground">Nenhuma aula marcada.</span>}
          </li>
          <li className="text-muted-foreground">
            Presença da última aula fechada: {data?.presencaUltima
              ? fracaoComPct(data.presencaUltima.presentes, data.presencaUltima.total)
              : "nenhuma aula com lista fechada ainda"}.
          </li>
          <li className="text-muted-foreground">
            Frequência do mês: {data?.frequenciaMes
              ? fracaoComPct(data.frequenciaMes.presentes, data.frequenciaMes.total)
              : "sem aula fechada este mês"}.
          </li>
        </ul>
      )}
      <Link to="/classroom" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
        Abrir Classroom <ArrowRight className="size-3" />
      </Link>
    </section>
  );
}

/**
 * O bloco de engajamento (#220): quem está sumindo, antes de virar perda.
 * Só o dono — a lista cruza dado de toda área da plataforma.
 */
function BlocoEngajamento({ souDono }: { souDono: boolean }) {
  const fn = useServerFn(getResumoEngajamento);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["resumo-engajamento"], queryFn: () => fn(), enabled: souDono,
  });
  if (!souDono || isError) return null;

  return (
    <section className="rounded-xl bg-card p-5 ring-1 ring-black/5">
      <div className="flex items-center gap-2">
        <UserX className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium tracking-tight">Quem está sumindo</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Sem nenhuma atividade — login, teste, aula, trilha ou mentoria — há mais de 14 dias.
        Com poucos alunos na base, este bloco tende a apontar quase todos ou ninguém.
      </p>

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Carregando…</p>
      ) : !data || data.pessoas.length === 0 ? (
        <p className="mt-4 py-4 text-center text-sm text-muted-foreground">
          Ninguém se encaixa hoje — ou porque todo mundo está ativo, ou porque ainda não há dado suficiente.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {data.pessoas.map((p) => (
            <li key={p.person_id} className="flex items-center justify-between gap-3 text-sm">
              <Link to="/pessoas/$id" params={{ id: p.person_id }} className="truncate hover:underline">
                {p.nome}
              </Link>
              <span className="shrink-0 text-xs text-muted-foreground">
                {p.diasSemAtividade === null ? "sem nenhum registro de atividade" : `sumida há ${p.diasSemAtividade} dias`}
                {p.temTestePendente && " · teste pendente"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Um indicador de cada menu, e o ranking geral.
 *
 * Duas partes, de propósito. Em cima, FRASES: o Matheus abre o Dashboard para
 * saber o que fazer hoje, e "3 grupos vazios" diz isso — o número sozinho,
 * não. Embaixo, os cartões, para quem quer o número e o caminho para o menu.
 *
 * As frases são ordenadas por urgência e só aparecem quando têm o que dizer.
 * Painel que repete "0" em tudo ensina a pessoa a ignorar o painel.
 *
 * Academy e Comunidade vêm de funções PRÓPRIAS (getResumoAcademy/
 * getResumoComunidade), cada uma com sua checagem de permissão — sem a
 * permissão, a consulta falha e o card correspondente nem aparece. Mentorias
 * não existe mais aqui: virou a #270, que depende da #229.
 */
function Panorama({ souDono, minhasPermissoes }: { souDono: boolean; minhasPermissoes: string[] }) {
  const fn = useServerFn(getPanoramaGeral);
  const { data, isLoading } = useQuery({ queryKey: ["panorama"], queryFn: () => fn() });

  const podeAcademy = souDono || minhasPermissoes.includes("educacao");
  const podeComunidade = souDono || minhasPermissoes.includes("grupos");

  const academyFn = useServerFn(getResumoAcademy);
  const { data: academy, isError: academyErro } = useQuery({
    queryKey: ["resumo-academy"], queryFn: () => academyFn(), enabled: podeAcademy,
  });
  const comunidadeFn = useServerFn(getResumoComunidade);
  const { data: comunidade, isError: comunidadeErro } = useQuery({
    queryKey: ["resumo-comunidade"], queryFn: () => comunidadeFn(), enabled: podeComunidade,
  });

  if (isLoading || !data) {
    return (
      <section className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        <p className="text-sm text-muted-foreground">Levantando o panorama…</p>
      </section>
    );
  }

  const { pessoas, grupos, equipe, ranking } = data;

  const plural = (n: number, um: string, muitos: string) => `${n} ${n === 1 ? um : muitos}`;

  // Cada frase é um recado. Tom: primeiro o que pede ação, depois o que vai bem.
  const recados: Array<{ texto: string; tom: "acao" | "neutro" }> = [];

  if (pessoas.semGrupo > 0) {
    recados.push({
      tom: "acao",
      texto: `${plural(pessoas.semGrupo, "pessoa não está", "pessoas não estão")} em nenhum grupo — ${
        pessoas.semGrupo === 1 ? "ela não vê" : "elas não veem"
      } comunidade nem ranking.`,
    });
  }
  if (grupos.vazios > 0) {
    recados.push({
      tom: "acao",
      texto: `${plural(grupos.vazios, "grupo está vazio", "grupos estão vazios")}, sem ninguém dentro.`,
    });
  }
  if (pessoas.total > 0 && pessoas.comLogin === 0) {
    recados.push({
      tom: "acao",
      texto: "Ninguém criou login ainda — sem isso não há painel do aluno, comunidade nem pontos.",
    });
  }

  // Mesma regra do menu lateral (app-sidebar.tsx): cada cartão só aparece se a
  // permissão correspondente existir E a consulta daquela área tiver
  // respondido com sucesso — um colaborador sem a permissão nunca chega a ter
  // o dado para mostrar, então o card nem entra na lista.
  const cartoesTodos = [
    { to: "/grupos" as const, icone: FolderKanban, rotulo: "Grupos", ok: souDono || minhasPermissoes.includes("grupos"),
      n: grupos.total, det: `${grupos.pessoasEmGrupo} em grupo` },
    { to: "/pessoas" as const, icone: Users, rotulo: "Pessoas", ok: souDono || minhasPermissoes.includes("pessoas"),
      n: pessoas.total, det: `${pessoas.comLogin} com login` },
    { to: "/colaboradores" as const, icone: UsersRound, rotulo: "Equipe", ok: souDono,
      n: equipe.ativos, det: `${equipe.mentores} mentor${equipe.mentores === 1 ? "" : "es"}` },
    { to: "/educacao" as const, icone: BookOpen, rotulo: "Academy", ok: podeAcademy && !academyErro && !!academy,
      n: academy?.pessoasEmTrilha ?? 0,
      det: academy ? `${plural(academy.conclusoesNoMes, "conclusão", "conclusões")} no mês` : "" },
    { to: "/comunidades" as const, icone: MessagesSquare, rotulo: "Comunidade", ok: podeComunidade && !comunidadeErro && !!comunidade,
      n: comunidade?.postsNaSemana ?? 0,
      det: comunidade ? `${plural(comunidade.participantes, "participante", "participantes")} na semana` : "" },
  ];
  const cartoes = cartoesTodos.filter((c) => c.ok);

  return (
    <>
      {recados.length > 0 && (
        <section className="rounded-xl bg-card p-5 ring-1 ring-black/5">
          <h2 className="text-sm font-medium tracking-tight">Como está a operação</h2>
          <ul className="mt-3 space-y-2">
            {recados.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                    r.tom === "acao" ? "bg-amber-400" : "bg-muted-foreground/40"
                  }`}
                />
                <span className={r.tom === "acao" ? "" : "text-muted-foreground"}>{r.texto}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CardClassroom souDono={souDono} />

      {cartoes.length > 0 && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {cartoes.map((c) => (
            <Link
              key={c.rotulo}
              to={c.to}
              className="group rounded-xl bg-card p-4 ring-1 ring-black/5 transition hover:ring-black/15"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <c.icone className="size-4" />
                <span className="text-xs font-medium">{c.rotulo}</span>
                <ArrowRight className="ml-auto size-3.5 opacity-0 transition group-hover:opacity-60" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{c.n}</p>
              <p className="text-xs text-muted-foreground">{c.det}</p>
            </Link>
          ))}
        </section>
      )}

      <section className="rounded-xl bg-card p-5 ring-1 ring-black/5">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium tracking-tight">Ranking geral</h2>
          <span className="text-xs text-muted-foreground">todos os alunos, sem separar por grupo</span>
        </div>

        {!data.alguemPontuou ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Ninguém pontuou ainda. Os pontos vêm de concluir aula, participar de mentoria,
            publicar, comentar e curtir — responder teste não pontua.
          </p>
        ) : (
          <ol className="mt-4 space-y-1.5">
            {ranking.map((l) => (
              <li key={l.person_id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/40">
                <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {l.posicao}
                </span>
                <Avatar url={l.avatar_url} nome={l.nome} className="size-7" />
                <Link
                  to="/pessoas/$id"
                  params={{ id: l.person_id }}
                  className="min-w-0 flex-1 truncate text-sm hover:underline"
                >
                  {l.nome}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {l.acoes > 0 ? `${l.acoes} ${l.acoes === 1 ? "ação" : "ações"}` : "—"}
                </span>
                <span className="w-12 text-right text-sm font-medium tabular-nums">{l.total}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <BlocoEngajamento souDono={souDono} />
    </>
  );
}
