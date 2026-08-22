import { mensagemDeErro } from "@/lib/erro-legivel";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getGroup, getMyProfile, listPeople } from "@/lib/data.functions";
import { getEmailStatus, sendMentorEmail } from "@/lib/email.functions";
import { createInviteLink, listTestVersions, startResponse, startAssessment } from "@/lib/tests.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, ArrowRight, Check, Copy, Mail, MailCheck, MessageSquare } from "lucide-react";
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

type Resultado = {
  id: string; person: string; test: string;
  battery?: boolean; invite?: boolean;
  person_id?: string;
  /** null = não tentamos enviar */
  email?: { ok: true } | { ok: false; motivo: string } | null;
};

function NovoEnvio() {
  const nav = useNavigate();
  const { personId, groupId } = Route.useSearch();
  const [step, setStep] = useState(0);
  const [selectedVersions, setSelV] = useState<string[]>([]);
  const [selectedPeople, setPpl] = useState<string[]>(personId ? [personId] : []);
  const [createdLinks, setCreatedLinks] = useState<Resultado[] | null>(null);
  // Enviar o convite junto com a criação, em vez de link por link depois.
  const [enviarPorEmail, setEnviarPorEmail] = useState(true);
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
  const emailStatusFn = useServerFn(getEmailStatus);
  const enviarEmailFn = useServerFn(sendMentorEmail);
  const { data: emailStatus } = useQuery({ queryKey: ["email-status"], queryFn: () => emailStatusFn() });
  const mandarEmail = useMutation({
    mutationFn: (r: { id: string; battery?: boolean }) =>
      enviarEmailFn({
        data: {
          kind: "convite",
          response_id: r.battery ? null : r.id,
          assessment_id: r.battery ? r.id : null,
          origin: window.location.origin,
        },
      }),
    onSuccess: (res, r) => {
      toast.success(`Convite enviado para ${(res as { para: string }).para}`);
      setCreatedLinks((prev) => prev?.map((x) => (x.id === r.id ? { ...x, email: { ok: true } } : x)) ?? prev);
    },
    onError: (e: Error) => toast.error(mensagemDeErro(e)),
  });

  const getProfileFn = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["my-profile"], queryFn: () => getProfileFn(), staleTime: 60_000 });
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

  /**
   * Um cartão por inventário, não por versão. Antes, ter o modelo e uma cópia
   * do mesmo teste fazia os dois aparecerem lado a lado, como se fossem testes
   * diferentes. As versões do mentor vêm primeiro, então a primeira do grupo é
   * a sugestão padrão.
   */
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
  /** Link aberto não tem destinatário: não existe para quem mandar. */
  const podeEnviarEmail = !!emailStatus?.ativo && !openLink;
  const semEmail = selectedPeople.filter((id) => !people.find((p) => p.id === id)?.email).length;
  // Converte o horário local digitado para ISO; vazio = sem prazo.
  const expiresIso = expiresAt ? new Date(expiresAt).toISOString() : null;

  const confirm = useMutation({
    mutationFn: async () => {
      const results: Resultado[] = [];
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
            person_id,
          });
        }
        return results;
      }
      for (const version_id of selectedVersions) {
        for (const person_id of selectedPeople) {
          const row = await startFn({ data: { version_id, person_id, group_id: groupId ?? null, expires_at: expiresIso } });
          const person = people.find((p) => p.id === person_id);
          const test = publishedVersions.find((v) => v.id === version_id);
          results.push({ id: row.id, person: person?.full_name ?? "", test: test?.title ?? "", person_id });
        }
      }
      // Envio depois de tudo criado: se um email falhar, os links continuam
      // existindo e dá para reenviar pela própria tela de resultado.
      if (podeEnviarEmail && enviarPorEmail) {
        for (const r of results) {
          const pessoa = people.find((p) => p.id === r.person_id);
          if (!pessoa?.email) {
            r.email = { ok: false, motivo: "sem email cadastrado" };
            continue;
          }
          try {
            await enviarEmailFn({
              data: {
                kind: "convite",
                response_id: r.battery ? null : r.id,
                assessment_id: r.battery ? r.id : null,
                origin: window.location.origin,
              },
            });
            r.email = { ok: true };
          } catch (e) {
            r.email = { ok: false, motivo: mensagemDeErro(e, undefined, "falhou") };
          }
        }
      }
      return results;
    },
    onSuccess: (results) => {
      setCreatedLinks(results);
      const enviados = results.filter((r) => r.email?.ok).length;
      const falhas = results.filter((r) => r.email && !r.email.ok).length;
      if (enviados > 0 && falhas === 0) toast.success(`${results.length} envio(s) criados e ${enviados} email(s) enviados`);
      else if (falhas > 0) toast.warning(`${results.length} criados · ${enviados} email(s) enviados, ${falhas} não`);
      else toast.success(`${results.length} envio(s) criados`);
    },
    onError: (e: unknown) => toast.error(mensagemDeErro(e, undefined, "Falha ao criar envios")),
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

  // Texto pronto das Configurações com {nome} e {link} preenchidos.
  const modelo = profile?.profile?.invite_message?.trim() || "";
  const mensagemPara = (r: { id: string; person: string; battery?: boolean; invite?: boolean }) =>
    modelo.replaceAll("{nome}", r.person || "").replaceAll("{link}", linkFor(r));

  const copyMensagem = (r: { id: string; person: string; battery?: boolean; invite?: boolean }) => {
    navigator.clipboard.writeText(mensagemPara(r));
    toast.success("Mensagem copiada");
  };

  if (createdLinks) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Envios criados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cada avaliado tem o link abaixo. Você pode mandar por email daqui, copiar o link, ou copiar a
            mensagem pronta — as três formas levam ao mesmo lugar.
          </p>
          {!modelo && (
            <p className="mt-2 text-xs text-muted-foreground">
              Dica: escreva sua mensagem de convite em{" "}
              <Link to="/configuracoes" className="font-medium text-accent hover:underline">Configurações → Mensagens</Link>{" "}
              e ela passa a sair pronta aqui.
            </p>
          )}
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-black/5 divide-y divide-black/5">
          {createdLinks.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{r.person}</span>
                  {r.email?.ok && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                      <MailCheck className="size-2.5" /> email enviado
                    </span>
                  )}
                  {r.email && !r.email.ok && (
                    <span
                      className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200"
                      title={r.email.motivo}
                    >
                      email não saiu — {r.email.motivo}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{r.test}</div>
                <div className="text-xs text-muted-foreground truncate">{linkFor(r)}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                {/* Link aberto não tem destinatário: não há para quem mandar. */}
                {emailStatus?.ativo && !r.invite && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => mandarEmail.mutate(r)}
                    disabled={mandarEmail.isPending}
                    title={r.email?.ok ? "Enviar de novo" : "Enviar o convite por email para o avaliado"}
                  >
                    <Mail className="size-3" /> {r.email?.ok ? "Reenviar" : "Email"}
                  </Button>
                )}
                {modelo && (
                  <Button variant="ghost" size="sm" onClick={() => copyMensagem(r)} title="Copia sua mensagem de convite com o nome e o link preenchidos">
                    <MessageSquare className="size-3" /> Mensagem
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => copy(r)}>
                  <Copy className="size-3" /> Link
                </Button>
              </div>
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
              Selecione um ou mais testes para enviar. Quando você tem mais de uma versão do mesmo
              inventário, ele aparece uma vez só — escolha a versão no seletor ao lado.
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
                      <button
                        onClick={() => toggle(selectedVersions, setSelV, escolhida.id)}
                        className="flex w-full items-start gap-3 text-left"
                      >
                        <Checkbox checked={on} className="mt-0.5" />
                        <div className="min-w-0">
                          <span className="text-sm font-medium">{escolhida.title}</span>
                          {escolhida.description && (
                            <div className="text-xs text-muted-foreground line-clamp-2">{escolhida.description}</div>
                          )}
                        </div>
                      </button>

                      {/* Só aparece quando há mesmo o que escolher. */}
                      {grupo.versoes.length > 1 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/5 pt-3">
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Versão</span>
                          {grupo.versoes.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => {
                                // Escolher uma versão já marca o teste: tira
                                // qualquer versão deste inventário e põe esta.
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
            {podeEnviarEmail && (
              <div className="space-y-3 rounded-lg bg-muted/40 p-4 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="mandaremail" className="text-sm font-medium">Enviar o convite por email agora</Label>
                    <p className="text-xs text-muted-foreground">
                      Cada avaliado recebe o link no email dele, com a sua marca e o texto de Mensagens.
                    </p>
                  </div>
                  <Switch id="mandaremail" checked={enviarPorEmail} onCheckedChange={setEnviarPorEmail} />
                </div>
                {enviarPorEmail && semEmail > 0 && (
                  <p className="text-xs text-amber-700">
                    {semEmail === 1
                      ? "1 avaliado selecionado não tem email cadastrado — para ele, só o link."
                      : `${semEmail} avaliados selecionados não têm email cadastrado — para eles, só o link.`}
                  </p>
                )}
              </div>
            )}
            {!podeEnviarEmail && !openLink && !emailStatus?.ativo && (
              <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground ring-1 ring-black/5">
                O envio por email ainda não está ligado. Você vai receber os links para compartilhar do seu jeito —
                dá para ligar o email em <Link to="/configuracoes" className="underline">Configurações → Emails</Link>.
              </div>
            )}

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
              <Check className="size-4" />
              {confirm.isPending
                ? (podeEnviarEmail && enviarPorEmail ? "Criando e enviando…" : "Criando…")
                : (podeEnviarEmail && enviarPorEmail ? "Confirmar e enviar por email" : "Confirmar envio")}
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