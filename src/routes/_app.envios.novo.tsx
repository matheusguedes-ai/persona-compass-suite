import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGroup, listPeople } from "@/lib/data.functions";
import { createInviteLink, listTestVersions, startResponse, startAssessment } from "@/lib/tests.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/envios/novo")({
  head: () => ({
    meta: [
      { title: "Novo envio — Métrica Humana" },
      { name: "description", content: "Assistente para disparar um novo teste." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    personId: typeof s.personId === "string" ? s.personId : undefined,
    // Vindo de um grupo: já entra com os membros e os testes liberados marcados.
    groupId: typeof s.groupId === "string" ? s.groupId : undefined,
  }),
  component: NovoEnvio,
});

const STEPS = ["Testes", "Destinatários", "Revisão"] as const;

function NovoEnvio() {
  const nav = useNavigate();
  const { personId, groupId } = Route.useSearch();
  const [step, setStep] = useState(0);
  const [selectedVersions, setSelV] = useState<string[]>([]);
  const [selectedPeople, setPpl] = useState<string[]>(personId ? [personId] : []);
  const [createdLinks, setCreatedLinks] = useState<{ id: string; person: string; test: string; battery?: boolean; invite?: boolean }[] | null>(null);
  const [battery, setBattery] = useState(true);
  // Link aberto: um link só, sem escolher pessoas — quem abre se identifica.
  const [openLink, setOpenLink] = useState(false);
  const [maxResponses, setMaxResponses] = useState("");
  // datetime-local: "2026-07-30T18:00" (horário de quem preenche)
  const [expiresAt, setExpiresAt] = useState("");

  const listPeopleFn = useServerFn(listPeople);
  const listVersionsFn = useServerFn(listTestVersions);
  const startFn = useServerFn(startResponse);
  const startAssessmentFn = useServerFn(startAssessment);
  const createInviteLinkFn = useServerFn(createInviteLink);

  const getGroupFn = useServerFn(getGroup);

  const { data: people = [] } = useQuery({ queryKey: ["people"], queryFn: () => listPeopleFn() });
  const { data: versions = [] } = useQuery({
    queryKey: ["test-versions"],
    queryFn: () => listVersionsFn({ data: {} }),
  });
  const { data: groupData } = useQuery({
    queryKey: ["group", groupId],
    queryFn: () => getGroupFn({ data: { id: groupId! } }),
    enabled: !!groupId,
  });
  // Templates publicados podem ser enviados direto — duplicar só é necessário
  // para quem quer editar perguntas. Versões do mentor aparecem primeiro.
  const publishedVersions = versions
    .filter((v) => v.is_published)
    .sort((a, b) => Number(a.is_template) - Number(b.is_template));

  // Pré-seleção do grupo: membros + testes liberados. Roda uma vez só, para
  // que desmarcar algo não seja desfeito no próximo render.
  const preenchido = useRef(false);
  useEffect(() => {
    if (preenchido.current || !groupId || !groupData || publishedVersions.length === 0) return;
    preenchido.current = true;

    setPpl(groupData.members.map((m) => m.person_id));

    // Um instrumento pode ter várias versões publicadas; publishedVersions já
    // vem com as do mentor na frente, então a primeira é a preferida.
    const liberados = groupData.instruments.map((i) => i.instrument_id);
    const escolhidas = liberados
      .map((instr) => publishedVersions.find((v) => v.instrument_id === instr)?.id)
      .filter((id): id is string => !!id);
    if (escolhidas.length > 0) setSelV(escolhidas);
  }, [groupId, groupData, publishedVersions]);

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  // Com link aberto não se escolhe destinatários: pula a etapa de pessoas.
  const canNext =
    (step === 0 && selectedVersions.length > 0) ||
    (step === 1 && (openLink || selectedPeople.length > 0)) ||
    step === 2;

  const useBattery = battery && selectedVersions.length > 1;
  // Converte o horário local digitado para ISO; vazio = sem prazo.
  const expiresIso = expiresAt ? new Date(expiresAt).toISOString() : null;

  const confirm = useMutation({
    mutationFn: async () => {
      const results: { id: string; person: string; test: string; battery?: boolean; invite?: boolean }[] = [];
      if (openLink) {
        const row = await createInviteLinkFn({
          data: {
            version_ids: selectedVersions,
            group_id: groupId ?? null,
            expires_at: expiresIso,
            max_responses: maxResponses ? Number(maxResponses) : null,
          },
        });
        results.push({
          id: row.id,
          person: "Link aberto",
          test: selectedVersions.length > 1 ? `${selectedVersions.length} testes` : (publishedVersions.find((v) => v.id === selectedVersions[0])?.title ?? ""),
          invite: true,
        });
        return results;
      }
      if (useBattery) {
        for (const person_id of selectedPeople) {
          const row = await startAssessmentFn({
            data: { person_id, version_ids: selectedVersions, group_id: groupId ?? null, expires_at: expiresIso },
          });
          const person = people.find((p) => p.id === person_id);
          results.push({
            id: row.id,
            person: person?.full_name ?? "",
            test: `Bateria — ${selectedVersions.length} testes`,
            battery: true,
          });
        }
        return results;
      }
      for (const version_id of selectedVersions) {
        for (const person_id of selectedPeople) {
          const row = await startFn({ data: { version_id, person_id, group_id: groupId ?? null, expires_at: expiresIso } });
          const person = people.find((p) => p.id === person_id);
          const test = publishedVersions.find((v) => v.id === version_id);
          results.push({ id: row.id, person: person?.full_name ?? "", test: test?.title ?? "" });
        }
      }
      return results;
    },
    onSuccess: (results) => {
      setCreatedLinks(results);
      toast.success(`${results.length} envio(s) criados`);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao criar envios"),
  });

  const linkFor = (r: { id: string; battery?: boolean; invite?: boolean }) => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const path = r.invite ? "convite" : r.battery ? "bateria" : "responder";
    return `${base}/${path}/${r.id}`;
  };

  const copy = (r: { id: string; battery?: boolean; invite?: boolean }) => {
    navigator.clipboard.writeText(linkFor(r));
    toast.success("Link copiado");
  };

  if (createdLinks) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Envios criados</h1>
          <p className="mt-1 text-sm text-muted-foreground">Copie e compartilhe o link com cada avaliado.</p>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-black/5 divide-y divide-black/5">
          {createdLinks.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <div className="font-medium truncate">{r.person}</div>
                <div className="text-xs text-muted-foreground truncate">{r.test}</div>
                <div className="text-xs text-muted-foreground truncate">{linkFor(r)}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copy(r)}>
                <Copy className="size-3" /> Copiar
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => nav({ to: "/envios" })}>Ir para Envios</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link to="/envios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Novo envio</h1>
        {groupData && (
          <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground ring-1 ring-black/5">
            Enviando para o grupo <span className="font-medium text-foreground">{groupData.group.name}</span> —
            {" "}{groupData.members.length} {groupData.members.length === 1 ? "pessoa" : "pessoas"} e
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
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Selecione um ou mais testes para enviar. Você pode usar os modelos prontos ou suas próprias versões —
              para editar perguntas, duplique o modelo em <Link to="/testes" className="underline">Testes</Link>.
            </p>
            {publishedVersions.length === 0 ? (
              <div className="rounded-lg bg-muted/40 p-6 text-sm text-muted-foreground ring-1 ring-black/5">
                Nenhum teste disponível. Publique uma versão em <Link to="/testes" className="underline">Testes</Link>.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {publishedVersions.map((v) => {
                  const on = selectedVersions.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      onClick={() => toggle(selectedVersions, setSelV, v.id)}
                      className={`flex items-start gap-3 rounded-lg p-4 text-left ring-1 transition-colors ${
                        on ? "bg-accent/10 ring-accent" : "bg-muted/40 ring-black/5 hover:bg-muted"
                      }`}
                    >
                      <Checkbox checked={on} className="mt-0.5" />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{v.title}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {v.is_template ? "Modelo" : "Minha versão"}
                          </span>
                        </div>
                        {v.description && <div className="text-xs text-muted-foreground line-clamp-2">{v.description}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {selectedVersions.length > 1 && (
              <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 p-4 ring-1 ring-black/5">
                <div>
                  <Label htmlFor="battery" className="text-sm font-medium">Gerar link único (bateria)</Label>
                  <p className="text-xs text-muted-foreground">
                    O avaliado responde todos os testes em etapas, com um único link.
                  </p>
                </div>
                <Switch id="battery" checked={battery} onCheckedChange={setBattery} />
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/40 p-4 ring-1 ring-black/5">
              <div>
                <Label htmlFor="openlink" className="text-sm font-medium">Link aberto (compartilhável)</Label>
                <p className="text-xs text-muted-foreground">
                  Um único link para mandar ao grupo. Quem abrir informa nome e email, e é cadastrado automaticamente.
                </p>
              </div>
              <Switch id="openlink" checked={openLink} onCheckedChange={setOpenLink} />
            </div>

            {openLink ? (
              <div className="space-y-3 rounded-lg bg-card p-4 ring-1 ring-black/5">
                <div className="space-y-2">
                  <Label htmlFor="max">Limite de respostas</Label>
                  <Input
                    id="max" type="number" min={1} max={10000} placeholder="Sem limite"
                    value={maxResponses} onChange={(e) => setMaxResponses(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Deixe vazio para não limitar.</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Escolha quem receberá o(s) teste(s).</p>
            )}
            {!openLink &&
              (people.length === 0 ? (
              <div className="rounded-lg bg-muted/40 p-6 text-sm text-muted-foreground ring-1 ring-black/5">
                Nenhuma pessoa cadastrada. Vá em <Link to="/pessoas" className="underline">Pessoas</Link> para adicionar.
              </div>
            ) : (
              <div className="max-h-96 space-y-1 overflow-auto">
                {people.map((p) => {
                  const on = selectedPeople.includes(p.id);
                  return (
                    <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 ring-1 transition-colors ${
                      on ? "bg-accent/10 ring-accent" : "ring-transparent hover:bg-muted/40"
                    }`}>
                      <Checkbox checked={on} onCheckedChange={() => toggle(selectedPeople, setPpl, p.id)} />
                      <div className="grid size-8 place-items-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600 ring-1 ring-black/5">
                        {p.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{p.full_name}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ))}

            <div className="space-y-2 rounded-lg bg-card p-4 ring-1 ring-black/5">
              <Label htmlFor="expira">Disponível até (opcional)</Label>
              <Input
                id="expira" type="datetime-local"
                value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Depois desta data e horário o link para de aceitar respostas. Deixe vazio para não expirar.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-sm">
            <Row label="Testes" value={selectedVersions.map((id) => publishedVersions.find((v) => v.id === id)?.title).filter(Boolean).join(", ")} />
            <Row label="Destinatários" value={openLink ? "Link aberto — quem receber se identifica" : `${selectedPeople.length} pessoa(s)`} />
            <Row
              label="Formato"
              value={openLink
                ? (selectedVersions.length > 1 ? "Link aberto (bateria em etapas)" : "Link aberto")
                : useBattery ? "Link único (bateria em etapas)" : "Um link por teste"}
            />
            {openLink
              ? <Row label="Limite de respostas" value={maxResponses ? `${maxResponses} pessoa(s)` : "Sem limite"} />
              : <Row label="Total de envios" value={`${(useBattery ? 1 : selectedVersions.length) * selectedPeople.length}`} />}
            <Row label="Disponível até" value={expiresAt ? new Date(expiresAt).toLocaleString("pt-BR") : "Sem prazo"} />
            <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground ring-1 ring-black/5">
              {openLink
                ? "Ao confirmar, será gerado um único link para compartilhar. Cada pessoa que abrir informa nome e email e é cadastrada automaticamente."
                : "Ao confirmar, os disparos serão registrados e cada avaliado receberá um link único de resposta."}
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
            <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
              <Check className="size-4" /> {confirm.isPending ? "Criando…" : "Confirmar envio"}
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