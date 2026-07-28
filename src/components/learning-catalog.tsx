/**
 * Catálogo de trilhas em prateleiras horizontais, no estilo das plataformas de
 * streaming. Serve tanto para a equipe (que também administra) quanto para o
 * aluno — o que muda é só o `podeEditar`.
 */
import { Link } from "@tanstack/react-router";
import { GraduationCap, Lock, PlayCircle } from "lucide-react";

export type TrackCard = {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  audience: string;
  is_published: boolean;
  lessons_count?: number;
};

const PUBLICO_LABEL: Record<string, string> = {
  alunos: "Alunos",
  equipe: "Equipe",
  ambos: "Todos",
};

/** Cor estável a partir do título: sem capa, cada trilha ganha a sua. */
function corDoTitulo(t: string) {
  let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 55% 34%), hsl(${(h + 40) % 360} 60% 22%))`;
}

export type CatalogBase = "/educacao" | "/aluno/educacao";

export function TrackCardItem({ t, base }: { t: TrackCard; base: CatalogBase }) {
  // O roteador exige uma rota literal, não uma montada com template.
  const to = base === "/educacao" ? "/educacao/$trackId" : "/aluno/educacao/$trackId";
  return (
    <Link
      to={to}
      params={{ trackId: t.id }}
      className="group relative block w-60 shrink-0 overflow-hidden rounded-xl ring-1 ring-black/5 transition hover:ring-2 hover:ring-primary"
    >
      <div className="relative h-32 w-full" style={{ background: corDoTitulo(t.title) }}>
        {t.cover_url && (
          <img src={t.cover_url} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <PlayCircle className="absolute inset-0 m-auto size-10 text-white/0 transition group-hover:text-white/90" />
        {!t.is_published && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Lock className="size-2.5" /> rascunho
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-white">{t.title}</p>
        </div>
      </div>
      <div className="bg-card p-3">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {t.description || "Sem descrição."}
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          {t.lessons_count != null && <>{t.lessons_count} aula{t.lessons_count === 1 ? "" : "s"} · </>}
          {PUBLICO_LABEL[t.audience] ?? t.audience}
        </p>
      </div>
    </Link>
  );
}

export function Prateleira({
  titulo, ajuda, trilhas, base,
}: { titulo: string; ajuda?: string; trilhas: TrackCard[]; base: CatalogBase }) {
  if (trilhas.length === 0) return null;
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-base font-medium tracking-tight">{titulo}</h2>
        {ajuda && <p className="text-xs text-muted-foreground">{ajuda}</p>}
      </div>
      {/* Rolagem horizontal: a lista cresce para o lado sem empurrar a página. */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {trilhas.map((t) => <TrackCardItem key={t.id} t={t} base={base} />)}
      </div>
    </section>
  );
}

export function CatalogoVazio({ podeEditar }: { podeEditar: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center ring-1 ring-black/5">
      <GraduationCap className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 text-base font-medium">Nenhuma trilha por aqui ainda</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {podeEditar
          ? "Crie a primeira trilha, organize em módulos e adicione aulas com vídeo do YouTube e materiais por link."
          : "Assim que seu mentor publicar uma trilha, ela aparece aqui."}
      </p>
    </div>
  );
}
