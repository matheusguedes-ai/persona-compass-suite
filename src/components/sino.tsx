/**
 * O sino: as novidades de quem está logado.
 *
 * O mesmo componente serve o dono, o mentor e o aluno — quem recebe o quê já
 * foi decidido no banco, quando a notificação foi criada. A tela não filtra
 * nada, ela só lê o que é da pessoa.
 *
 * Abrir o sino marca tudo como lido. É o comportamento que as pessoas esperam
 * e evita o contador que nunca zera; quem quiser reler continua com a lista.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarNotificacoes, marcarTodasLidas } from "@/lib/notificacoes.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";

function quando(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ontem";
  if (d < 7) return `${d} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * O mesmo evento leva a telas diferentes conforme quem clica.
 *
 * A notificação guarda a rota do DONO ("/comunidades"). Para o aluno essa rota
 * não existe — ele vive em /aluno. Sem traduzir, clicar na notificação jogaria
 * o aluno no painel do dono, exatamente o que aconteceu com o menu Grupos do
 * mentor. A tradução fica aqui, e não no banco, porque a notificação é uma só:
 * quem muda é quem lê.
 */
const NO_ALUNO: Record<string, string> = {
  "/comunidades": "/aluno/comunidade",
  "/mentorias": "/aluno/mentorias",
  "/educacao": "/aluno/educacao",
  "/pessoas": "/aluno",
};

/**
 * Traduz o link, preservando o que vem depois do `?` — a notificação de
 * menção (#55) grava "/comunidades?post=<id>" para abrir direto na
 * publicação. Sem separar a query, a busca em NO_ALUNO nunca batia (o mapa
 * só conhece a rota pura), e o aluno era jogado na rota do DONO.
 */
function linkTraduzido(link: string, area: "dono" | "aluno"): string {
  if (area !== "aluno") return link;
  const [base, query] = link.split("?");
  const novaBase = NO_ALUNO[base] ?? base;
  return query ? `${novaBase}?${query}` : novaBase;
}

export function Sino({ area = "dono" }: { area?: "dono" | "aluno" }) {
  const qc = useQueryClient();
  const listaFn = useServerFn(listarNotificacoes);
  const lerFn = useServerFn(marcarTodasLidas);
  const [aberto, setAberto] = useState(false);

  const { data } = useQuery({
    queryKey: ["notificacoes"],
    queryFn: () => listaFn(),
    // Sem WebSocket: uma checagem por minuto é suficiente e barata. Quem quiser
    // ver na hora, recarrega.
    refetchInterval: 60_000,
  });

  const marcar = useMutation({
    mutationFn: () => lerFn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notificacoes"] }),
  });

  const itens = data?.notificacoes ?? [];
  const naoLidas = data?.naoLidas ?? 0;

  return (
    <Popover
      open={aberto}
      onOpenChange={(v) => {
        setAberto(v);
        if (v && naoLidas > 0) marcar.mutate();
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          title={naoLidas > 0 ? `${naoLidas} novidade${naoLidas === 1 ? "" : "s"}` : "Notificações"}
        >
          <Bell className="size-4" />
          {naoLidas > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium leading-4 text-primary-foreground">
              {naoLidas > 9 ? "9+" : naoLidas}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-black/5 px-4 py-2.5">
          <p className="text-sm font-medium">Novidades</p>
        </div>

        {itens.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nada por aqui ainda.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-black/5 overflow-y-auto">
            {itens.map((n) => {
              const conteudo = (
                <>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium leading-snug">{n.titulo}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {quando(n.created_at)}
                    </span>
                  </div>
                  {n.corpo && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.corpo}</p>
                  )}
                </>
              );
              return (
                <li key={n.id} className={n.lida_em ? "" : "bg-primary/5"}>
                  {n.link ? (
                    <a
                      href={linkTraduzido(n.link, area)}
                      onClick={() => setAberto(false)}
                      className="block px-4 py-2.5 hover:bg-muted/50"
                    >
                      {conteudo}
                    </a>
                  ) : (
                    <div className="px-4 py-2.5">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
