import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/data.functions";
import { getMyMembership } from "@/lib/team.functions";
import { getPanoramaGeral } from "@/lib/painel.functions";
import { Avatar } from "@/components/avatar-upload";
import {
  FolderKanban, Users, MessagesSquare, BookOpen, UsersRound, Trophy, ArrowRight,
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
      { name: "description", content: "Visão geral dos testes enviados, respondidos e pendentes na plataforma de assessments." },
      { property: "og:title", content: "Dashboard — Métrica Humana" },
      { property: "og:description", content: "Visão geral dos testes enviados, respondidos e pendentes na plataforma de assessments." },
    ],
  }),
  component: () => (
    <RedirecionaMentor>
      <Dashboard />
    </RedirecionaMentor>
  ),
});

function Dashboard() {
  const statsFn = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => statsFn(),
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
          Acompanhe seus disparos e respostas em tempo real.
        </p>
      </div>

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

      <Panorama />

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
    </div>
  );
}

/**
 * Um indicador de cada menu, e o ranking geral.
 *
 * Duas partes, de propósito. Em cima, FRASES: o Matheus abre o Dashboard para
 * saber o que fazer hoje, e "3 mentorias agendadas pela frente" diz isso — o
 * número 3 sozinho, não. Embaixo, os cartões, para quem quer o número
 * e o caminho para o menu.
 *
 * As frases são ordenadas por urgência e só aparecem quando têm o que dizer.
 * Painel que repete "0" em tudo ensina a pessoa a ignorar o painel.
 */
function Panorama() {
  const fn = useServerFn(getPanoramaGeral);
  const { data, isLoading } = useQuery({ queryKey: ["panorama"], queryFn: () => fn() });
  const membershipFn = useServerFn(getMyMembership);
  const { data: membership } = useQuery({
    queryKey: ["my-membership"], queryFn: () => membershipFn(), staleTime: 300_000,
  });
  const souDono = (membership?.kind ?? "owner") === "owner";
  const minhasPermissoes = membership?.permissions ?? [];

  if (isLoading || !data) {
    return (
      <section className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        <p className="text-sm text-muted-foreground">Levantando o panorama…</p>
      </section>
    );
  }

  const { pessoas, grupos, equipe, mentorias, educacao, comunidade, ranking } = data;

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
  if (mentorias.agendadas > 0) {
    recados.push({
      tom: "neutro",
      texto: `${plural(mentorias.agendadas, "mentoria agendada", "mentorias agendadas")} pela frente.`,
    });
  }
  if (comunidade.posts7 > 0 || comunidade.comentarios7 > 0) {
    recados.push({
      tom: "neutro",
      texto: `A comunidade teve ${plural(comunidade.posts7, "publicação", "publicações")} e ${plural(
        comunidade.comentarios7, "comentário", "comentários",
      )} nos últimos 7 dias.`,
    });
  } else if (comunidade.posts > 0) {
    recados.push({ tom: "neutro", texto: "A comunidade está parada há mais de uma semana." });
  }
  if (educacao.alunosEstudando > 0) {
    recados.push({
      tom: "neutro",
      texto: `${plural(educacao.alunosEstudando, "aluno está", "alunos estão")} estudando, com ${plural(
        educacao.conclusoes, "aula concluída", "aulas concluídas",
      )}.`,
    });
  }

  // Mesma regra do menu lateral (app-sidebar.tsx): cada cartão só aparece se
  // a permissão correspondente existir. Sem isso, um colaborador só de Envios
  // via aqui um atalho clicável para telas que ele não deveria nem saber que
  // existem — o cartão de "Pessoas" já seria, sozinho, o convite a testar.
  const cartoesTodos = [
    { to: "/grupos" as const, icone: FolderKanban, rotulo: "Grupos", perm: "grupos" as const,
      n: grupos.total, det: `${grupos.pessoasEmGrupo} em grupo` },
    { to: "/pessoas" as const, icone: Users, rotulo: "Pessoas", perm: "pessoas" as const,
      n: pessoas.total, det: `${pessoas.comLogin} com login` },
    { to: "/colaboradores" as const, icone: UsersRound, rotulo: "Equipe", perm: null,
      n: equipe.ativos, det: `${equipe.mentores} mentor${equipe.mentores === 1 ? "" : "es"}` },
    { to: "/mentorias" as const, icone: MessagesSquare, rotulo: "Mentorias", perm: "mentorias" as const,
      n: mentorias.agendadas, det: `${mentorias.realizadas} já feitas` },
    { to: "/educacao" as const, icone: BookOpen, rotulo: "Academy", perm: "educacao" as const,
      n: educacao.aulas, det: `${educacao.trilhas} trilha${educacao.trilhas === 1 ? "" : "s"}` },
    { to: "/comunidades" as const, icone: MessagesSquare, rotulo: "Comunidade", perm: "grupos" as const,
      n: comunidade.posts, det: `${comunidade.comentarios} comentário${comunidade.comentarios === 1 ? "" : "s"}` },
  ];
  const cartoes = cartoesTodos.filter(
    (c) => souDono || (c.perm === null ? false : minhasPermissoes.includes(c.perm)),
  );

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
    </>
  );
}
