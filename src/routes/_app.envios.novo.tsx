/**
 * #301 — Nova campanha.
 *
 * Antes disto era "Novo envio": escolher teste(s) e já escolher pessoas e
 * mandar, tudo numa tacada. Virou criar o CONTAINER — nome, teste(s), grupo,
 * período, limite — sem pessoa nenhuma ainda. Quem recebe é escolhido DEPOIS,
 * na própria página da campanha (`/envios/$campanhaId`), porque uma campanha
 * existe pra receber gente aos poucos, não só na hora da criação.
 *
 * O link aberto deixou de ser uma opção à parte: toda campanha JÁ tem um link
 * compartilhável (mostrado na página dela) — o "link aberto" de antes era
 * basicamente uma campanha sem destinatário escolhido, que é exatamente o
 * estado inicial de qualquer campanha agora.
 */
import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGroup, listGroups } from "@/lib/data.functions";
import { createInviteLink, listTestVersions } from "@/lib/tests.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/envios/novo")({
  head: () => ({
    meta: [
      { title: "Nova campanha — Métrica Humana" },
      { name: "description", content: "Criar uma campanha para organizar testes enviados." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    personId: typeof s.personId === "string" ? s.personId : undefined,
    // Vindo de um grupo: já entra com os testes liberados marcados.
    groupId: typeof s.groupId === "string" ? s.groupId : undefined,
  }),
  component: NovaCampanha,
});

const STEPS = ["Nome e testes", "Configurações", "Revisão"] as const;

function NovaCampanha() {
  const nav = useNavigate();
  const { groupId } = Route.useSearch();
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [selectedVersions, setSelV] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>(groupId ?? "");
  const [maxResponses, setMaxResponses] = useState("");
  // datetime-local: "2026-07-30T18:00" (horário de quem preenche)
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const listVersionsFn = useServerFn(listTestVersions);
  const listGroupsFn = useServerFn(listGroups);
  const createInviteLinkFn = useServerFn(createInviteLink);
  const getGroupFn = useServerFn(getGroup);

  const { data: versions = [] } = useQuery({
    queryKey: ["test-versions"],
    queryFn: () => listVersionsFn({ data: {} }),
  });
  const { data: groups = [] } = useQuery({ queryKey: ["groups"], queryFn: () => listGroupsFn() });
  const { data: groupData } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroupFn({ data: { id: groupId! } }),
    enabled: !!groupId,
  });

  const publishedVersions = versions
    .filter((v) => v.is_published)
    .sort((a, b) => Number(a.is_template) - Number(b.is_template));

  /** Um cartão por inventário, não por versão — ver a mesma lógica no menu de Testes. */
  const porInstrumento = useMemo(() => {
    const mapa = new Map<string, typeof publishedVersions>();
    for (const v of publishedVersions) {
      const chave = v.instrument_id ?? v.id;
      const lista = mapa.get(chave) ?? [];
      lista.push(v);
      mapa.set(chave, lista);
    }
    return Array.from(mapa.entries()).map(([instrumentId, versoes]) => ({ instrumentId, versoes }));
  }, [publishedVersions]);

  // Pré-seleção do grupo: testes liberados + nome sugerido. Roda uma vez só.
  const preenchido = useRef(false);
  useEffect(() => {
    if (preenchido.current || !groupId || !groupData || publishedVersions.length === 0) return;
    preenchido.current = true;
    if (!nome.trim()) setNome(groupData.group.name);
    const liberados = groupData.instruments.map((i) => i.instrument_id);
    const escolhidas = liberados
      .map((instr) => publishedVersions.find((v) => v.instrument_id === instr)?.id)
      .filter((id): id is string => !!id);
    if (escolhidas.length > 0) setSelV(escolhidas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, groupData, publishedVersions]);

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const canNext =
    (step === 0 && nome.trim().length > 0 && selectedVersions.length > 0) ||
    step === 1 || step === 2;

  const startsIso = startsAt ? new Date(startsAt).toISOString() : null;
  const expiresIso = expiresAt ? new Date(expiresAt).toISOString() : null;

  const confirmar = useMutation({
    mutationFn: () => createInviteLinkFn({
      data: {
        title: nome.trim(),
        version_ids: selectedVersions,
        group_id: selectedGroup || null,
        starts_at: startsIso,
        expires_at: expiresIso,
        max_responses: maxResponses ? Number(maxResponses) : null,
      },
    }),
    onSuccess: (campanha) => {
      toast.success("Campanha criada");
      nav({ to: "/envios/$campanhaId", params: { campanhaId: campanha.id } });
    },
    onError: (e: unknown) => toast.error(mensagemDeErro(e, { title: "Nome" }, "Falha ao criar a campanha")),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link to="/envios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nova campanha</h1>
        {groupData && (
          <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground ring-1 ring-black/5">
            A partir do grupo <span className="font-medium text-foreground">{groupData.group.name}</span> —
            {" "}{groupData.instruments.length} {groupData.instruments.length === 1 ? "teste liberado" : "testes liberados"} já
            {" "}vieram marcados. Você pode ajustar antes de confirmar.
          </p>
        )}
      </div>

      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-2">
            <div className={`grid size-6 place-items-center rounded-full text-[11px] font-semibold ${
              i < step ? "bg-primary text-primary-foreground" :
              i === step ? "bg-accent text-accent-foreground" :
              "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <Check className="size-3" /> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="h-px flex-1 bg-black/10" />}
          </li>
        ))}
      </ol>

      <div className="rounded-xl bg-card p-6 ring-1 ring-black/5">
        {step === 0 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da campanha</Label>
              <Input
                id="nome" placeholder='Ex.: "T4 — Método Intenção" ou "Palestra ACIB — outubro"'
                value={nome} onChange={(e) => setNome(e.target.value)} maxLength={160}
              />
              <p className="text-xs text-muted-foreground">
                É o que você vai usar pra achar estas respostas depois — capriche.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Selecione um ou mais testes. Mais de um vira uma bateria — a pessoa responde todos em
                etapas, com um único link.
              </p>
              {publishedVersions.length === 0 ? (
                <div className="rounded-lg bg-muted/40 p-6 text-sm text-muted-foreground ring-1 ring-black/5">
                  Nenhum teste disponível. Publique uma versão em <Link to="/testes" className="underline">Testes</Link>.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {porInstrumento.map((grupo) => {
                    const escolhida = grupo.versoes.find((v) => selectedVersions.includes(v.id)) ?? grupo.versoes[0];
                    const on = selectedVersions.includes(escolhida.id);
                    return (
                      <div
                        key={grupo.instrumentId}
                        className={`rounded-lg p-4 ring-1 transition-colors ${
                          on ? "bg-accent/10 ring-accent" : "bg-muted/40 ring-black/5"
                        }`}
                      >
                        {/* div, não button: o Checkbox já É um <button role="checkbox">,
                            e HTML não aceita botão dentro de botão (quebrava a hidratação). */}
                        <div
                          role="button" tabIndex={0}
                          onClick={() => toggle(selectedVersions, setSelV, escolhida.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggle(selectedVersions, setSelV, escolhida.id);
                            }
                          }}
                          className="flex w-full items-start gap-3 text-left cursor-pointer"
                        >
                          <Checkbox checked={on} className="mt-0.5" />
                          <div className="min-w-0">
                            <span className="text-sm font-medium">{escolhida.title}</span>
                            {escolhida.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2">{escolhida.description}</div>
                            )}
                          </div>
                        </div>
                        {grupo.versoes.length > 1 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
                            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Versão</span>
                            {grupo.versoes.map((v) => (
                              <button
                                key={v.id}
                                onClick={() => {
                                  const outras = selectedVersions.filter((id) => !grupo.versoes.some((g) => g.id === id));
                                  setSelV([...outras, v.id]);
                                }}
                                className={`rounded-full px-2.5 py-1 text-[11px] transition ${
                                  v.id === escolhida.id
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                                }`}
                              >
                                {v.is_template ? "Modelo" : v.title.replace(/^.*—\s*/, "")}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="grupo">Grupo (opcional)</Label>
              <Select value={selectedGroup || "nenhum"} onValueChange={(v) => setSelectedGroup(v === "nenhum" ? "" : v)}>
                <SelectTrigger id="grupo"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Nenhum</SelectItem>
                  {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Quem entrar pelo link desta campanha é colocado neste grupo automaticamente.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inicio">Começa em (opcional)</Label>
                <Input id="inicio" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                <p className="text-xs text-muted-foreground">Antes disto, o link não aceita respostas.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fim">Disponível até (opcional)</Label>
                <Input id="fim" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                <p className="text-xs text-muted-foreground">Depois disto, o link para de aceitar.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max">Limite de respostas (opcional)</Label>
              <Input
                id="max" type="number" min={1} max={10000} placeholder="Sem limite"
                value={maxResponses} onChange={(e) => setMaxResponses(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-sm">
            <Row label="Nome" value={nome} />
            <Row label="Testes" value={selectedVersions.map((id) => publishedVersions.find((v) => v.id === id)?.title).filter(Boolean).join(", ")} />
            <Row label="Formato" value={selectedVersions.length > 1 ? "Bateria em etapas, um link" : "Um link"} />
            <Row label="Grupo" value={groups.find((g) => g.id === selectedGroup)?.name ?? "Nenhum"} />
            <Row label="Começa em" value={startsAt ? new Date(startsAt).toLocaleString("pt-BR") : "Assim que criar"} />
            <Row label="Disponível até" value={expiresAt ? new Date(expiresAt).toLocaleString("pt-BR") : "Sem prazo"} />
            <Row label="Limite de respostas" value={maxResponses ? `${maxResponses} pessoa(s)` : "Sem limite"} />
            <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground ring-1 ring-black/5">
              Ao confirmar, a campanha é criada com um link pra compartilhar. Você escolhe quem recebe por
              e-mail na página dela, quando quiser — inclusive depois, aos poucos.
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft className="size-4" /> Anterior
          </Button>
          {step < STEPS.length - 1 ? (
            <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
              Próximo <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={() => confirmar.mutate()} disabled={confirmar.isPending}>
              <Check className="size-4" /> {confirmar.isPending ? "Criando…" : "Criar campanha"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-black/5 pb-3 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
