/**
 * Catálogo de treinamentos presenciais em prateleiras — o irmão do
 * learning-catalog. Serve o master (que administra) e o aluno; o que muda é a
 * base das rotas e o rodapé do card: contagem de grupos é assunto de quem
 * publica, não de quem participa.
 */
import { Link } from "@tanstack/react-router";
import { Lock, Presentation } from "lucide-react";
import { corDoTitulo } from "@/components/learning-catalog";

export type TreinamentoCard = {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  publicado: boolean;
  aulas_count: number;
  grupos_count: number;
};

export type ClassroomBase = "/classroom" | "/aluno/classroom";

export function TreinamentoCardItem({
  t, base, search,
}: { t: TreinamentoCard; base: ClassroomBase; search?: { ver?: string } }) {
  // O roteador exige uma rota literal, não uma montada com template.
  const to = base === "/classroom" ? "/classroom/$treinamentoId" : "/aluno/classroom/$treinamentoId";
  return (
    <Link
      to={to}
      params={{ treinamentoId: t.id }}
      search={search}
      className="group relative block w-60 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5 transition hover:ring-2 hover:ring-primary"
    >
      <div className="relative h-32 w-full" style={{ background: corDoTitulo(t.titulo) }}>
        {t.capa_url && (
          <img src={t.capa_url} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <Presentation className="absolute inset-0 m-auto size-10 text-white/0 transition group-hover:text-white/90" />
        {!t.publicado && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Lock className="size-2.5" /> rascunho
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{t.titulo}</p>
        </div>
      </div>
      <div className="bg-card p-3">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {t.descricao || "Sem descrição."}
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {t.aulas_count} aula{t.aulas_count === 1 ? "" : "s"}
          {base === "/classroom" && <> · {t.grupos_count} grupo{t.grupos_count === 1 ? "" : "s"}</>}
        </p>
      </div>
    </Link>
  );
}

export function PrateleiraTreinamentos({
  titulo, ajuda, treinamentos, base, search,
}: {
  titulo: string; ajuda?: string; treinamentos: TreinamentoCard[]; base: ClassroomBase;
  search?: { ver?: string };
}) {
  if (treinamentos.length === 0) return null;
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-medium tracking-tight">{titulo}</h2>
        {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
      </div>
      {/* Rolagem horizontal: a lista cresce para o lado sem empurrar a página. */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {treinamentos.map((t) => <TreinamentoCardItem key={t.id} t={t} base={base} search={search} />)}
      </div>
    </section>
  );
}

export function ClassroomVazio({ podeEditar }: { podeEditar: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
      <Presentation className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 text-base font-medium">
        {podeEditar ? "Nenhum treinamento ainda" : "Nenhum treinamento por aqui ainda"}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {podeEditar
          ? "Crie o primeiro, organize os encontros em módulos e aulas, e escolha os grupos que participam."
          : "Assim que seu mentor liberar um treinamento presencial para o seu grupo, ele aparece aqui."}
      </p>
    </div>
  );
}
