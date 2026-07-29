/**
 * Grupos do mentor, dentro do painel dele.
 *
 * Antes o menu apontava para `/grupos`, que é a tela do DONO — abria no layout
 * do dono, com "Novo grupo" e a gestão da conta inteira. Errado por dois
 * motivos: não é o painel dele, e sugeria um poder que ele não tem.
 *
 * Aqui saem só os grupos atribuídos, com o que ele pode fazer em cada um: ver
 * quem está lá e cuidar das devolutivas, quando o dono liberou.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { Button } from "@/components/ui/button";
import { FolderKanban, MessagesSquare, Users } from "lucide-react";

function Pagina() {
  const fn = useServerFn(getMyMembership);
  const { data, isLoading } = useQuery({ queryKey: ["my-membership"], queryFn: () => fn() });

  const grupos = data?.groups ?? [];

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (data?.kind !== "mentor") {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center">
        <FolderKanban className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-4 text-base font-medium">Esta área é de quem atua como mentor</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Se você deveria ter acesso aqui, fale com quem administra a conta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grupos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Os grupos que você acompanha. O que você pode fazer em cada um é definido por quem
          administra a conta.
        </p>
      </div>

      {grupos.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/10 bg-card p-12 text-center">
          <FolderKanban className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-4 text-base font-medium">Nenhum grupo atribuído ainda</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Você foi promovido a mentor, mas ainda não recebeu nenhum grupo. Assim que receber, ele
            aparece aqui.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {grupos.map((g) => (
          <li key={g.group_id} className="rounded-xl border border-black/5 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {g.can_schedule_devolutivas ? "Você pode agendar devolutivas" : "Somente acompanhar"}
                  {" · "}
                  {g.can_download_reports ? "pode baixar relatórios" : "relatórios só na tela"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/aluno/comunidade" search={{ ver: undefined }}>
                    <Users className="size-3.5" /> Comunidade
                  </Link>
                </Button>
                {g.can_schedule_devolutivas && (
                  <Button size="sm" asChild>
                    <a href={`/grupos/${g.group_id}`}>
                      <MessagesSquare className="size-3.5" /> Devolutivas
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const Route = createFileRoute("/aluno/grupos")({
  head: () => ({ meta: [{ title: "Grupos" }, { name: "robots", content: "noindex" }] }),
  component: Pagina,
});
