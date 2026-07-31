import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Settings,
  Send,
  FolderKanban,
  GraduationCap,
  FlaskConical,
  UserCog,
  BookOpen,
  MessagesSquare,
  Users2,
  CalendarDays,
  Presentation,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyMembership } from "@/lib/team.functions";
import { useCurrentUser } from "@/lib/role-context";
import { BrandMark, useBrand } from "@/lib/brand";
import { Avatar } from "@/components/avatar-upload";
import { getMyProfile } from "@/lib/data.functions";
import { cn } from "@/lib/utils";

// `perm` = permissão de colaborador que libera o item; `soDono` = item de
// administração da conta. O menu escondido é só conforto: quem barra de
// verdade é a RLS do banco.
const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/grupos", label: "Grupos", icon: FolderKanban, perm: "grupos" },
  { to: "/pessoas", label: "Pessoas", icon: Users, perm: "pessoas" },
  // Só Colaboradores. MENTOR não se convida por tela própria: ele nasce de uma
  // pessoa já cadastrada, promovida na ficha dela (`promover_a_mentor`), e é
  // isso que garante UM cadastro por pessoa. Ver /mentores, que virou redirect.
  { to: "/colaboradores", label: "Colaboradores", icon: UserCog, soDono: true },
  { to: "/educacao", label: "Academy", icon: BookOpen, perm: "educacao" },
  // Presencial. Só o dono, como os eventos: a RLS de escrita exige
  // mentor_id = auth.uid(), e a decisão registrada é "menu do master".
  { to: "/classroom", label: "Classroom", icon: Presentation, soDono: true },
  // Testes, Envios e Devolutivas são o mesmo assunto em três momentos: o que
  // existe, o que foi disparado, e a conversa depois. Viraram um item só, com
  // abas dentro (ver AbasDeTestes).
  //
  // `perms` no plural, e o destino é calculado: quem tem só Envios precisa ver
  // o menu E cair em /envios. Com um `perm` fixo em "testes", esse colaborador
  // ficaria sem menu nenhum e sem caminho para a tela que é dele.
  { to: "/testes", label: "Testes", icon: FlaskConical, perms: ["testes", "envios", "devolutivas"] },
  { to: "/agenda", label: "Agenda", icon: CalendarDays, perm: "devolutivas" },
  { to: "/comunidades", label: "Comunidades", icon: Users2, perm: "grupos" },
  // Sem `perm`/`soDono` de propósito: todo mundo chega, mas a tela em si só
  // mostra Marca/Relatório/Mensagens/Emails/Agenda para o dono — quem não é
  // dono vê só "Meu perfil" (nome e foto). Ver _app.configuracoes.tsx.
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function AppSidebar() {
  const user = useCurrentUser();
  const brand = useBrand();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const membershipFn = useServerFn(getMyMembership);
  const perfilFn = useServerFn(getMyProfile);
  const { data: meuPerfil } = useQuery({ queryKey: ["my-profile"], queryFn: () => perfilFn(), staleTime: 60_000 });
  const { data: membership } = useQuery({
    queryKey: ["my-membership"],
    queryFn: () => membershipFn(),
    staleTime: 300_000,
  });

  // Sem resposta ainda, mostra o menu do dono: é o caso da esmagadora maioria
  // e evita o menu "piscar" itens aparecendo aos poucos.
  const kind = membership?.kind ?? "owner";
  const permissions = membership?.permissions ?? [];
  // O mentor não usa esta barra: ele é um avaliado promovido e vive no painel
  // do aluno, com Grupos a mais. Ver aluno.tsx.
  const items = NAV.filter((item) => {
    if (kind === "owner") return true;
    if ("soDono" in item && item.soDono) return false;
    // Item agrupado: basta ter uma das permissões para enxergá-lo.
    if ("perms" in item) return item.perms.some((p) => permissions.includes(p));
    if (!("perm" in item)) return true;
    return permissions.includes(item.perm);
  }).map((item) => {
    // E o destino é a primeira aba que ele realmente pode abrir.
    if (!("perms" in item) || kind === "owner") return item;
    const primeira = item.perms.find((p) => permissions.includes(p));
    const rota = primeira === "envios" ? "/envios"
      : primeira === "devolutivas" ? "/devolutivas" : "/testes";
    return { ...item, to: rota as typeof item.to };
  });
  const displayName = user?.displayName ?? "—";
  const email = user?.email ?? "";

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-black/5 bg-sidebar lg:flex">
      <div className="flex h-16 items-center px-6">
        <Link to="/">
          <BrandMark brand={brand} />
        </Link>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {items.map((item) => {
          const active =
            item.to === "/"
              ? pathname === "/"
              : pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        {/* Quem tem conta própria E é avaliado em outra. Sem este atalho, a
            área de aluno dele existe e responde, mas nenhum caminho da
            interface leva até lá — ele só chegaria digitando /aluno. Separado
            do menu por uma linha: é a outra conta, não mais um item desta. */}
        {membership?.tambem_avaliado && (
          <Link
            to="/aluno"
            search={{ ver: undefined }}
            className="mt-4 flex items-center gap-3 rounded-md border-t border-black/5 px-3 pb-2 pt-4 text-sm font-medium text-muted-foreground transition-colors hover:text-sidebar-accent-foreground"
          >
            <GraduationCap className="size-4 shrink-0" />
            Minha área de aluno
          </Link>
        )}
      </nav>

      <div className="border-t border-black/5 p-4">
        <div className="flex items-center gap-3">
          <Avatar url={meuPerfil?.profile?.avatar_url} nome={displayName} size={32} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-medium">{displayName}</span>
            <span className="truncate text-[10px] text-muted-foreground">{email}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}