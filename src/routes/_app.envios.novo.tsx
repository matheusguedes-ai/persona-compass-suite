import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { INSTRUMENTS, PEOPLE, CATEGORY_LABEL } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, ArrowRight, Check, Mail, Link2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/envios/novo")({
  head: () => ({
    meta: [
      { title: "Novo envio — Métrica Humana" },
      { name: "description", content: "Assistente para disparar um novo teste via email ou link." },
    ],
  }),
  component: NovoEnvio,
});

const STEPS = ["Instrumentos", "Destinatários", "Canal", "Revisão"] as const;

function NovoEnvio() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedInstruments, setSel] = useState<string[]>([]);
  const [selectedPeople, setPpl] = useState<string[]>([]);
  const [channel, setChannel] = useState<"email" | "link">("email");
  const [message, setMessage] = useState("Olá! Você foi convidado(a) a responder um assessment. Leva poucos minutos.");

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) =>
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const canNext =
    (step === 0 && selectedInstruments.length > 0) ||
    (step === 1 && selectedPeople.length > 0) ||
    step === 2 ||
    step === 3;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link to="/envios" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Novo envio</h1>
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
            <p className="text-sm text-muted-foreground">Selecione um ou mais instrumentos para enviar.</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {INSTRUMENTS.map((i) => {
                const on = selectedInstruments.includes(i.id);
                return (
                  <button
                    key={i.id}
                    onClick={() => toggle(selectedInstruments, setSel, i.id)}
                    className={`flex items-start gap-3 rounded-lg p-4 text-left ring-1 transition-colors ${
                      on ? "bg-accent/10 ring-accent" : "bg-muted/40 ring-black/5 hover:bg-muted"
                    }`}
                  >
                    <Checkbox checked={on} className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">{CATEGORY_LABEL[i.category]} · {i.durationMin}min</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Escolha quem receberá o(s) teste(s).</p>
            <div className="max-h-96 space-y-1 overflow-auto">
              {PEOPLE.map((p) => {
                const on = selectedPeople.includes(p.id);
                return (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-3 rounded-lg p-3 ring-1 transition-colors ${
                    on ? "bg-accent/10 ring-accent" : "ring-transparent hover:bg-muted/40"
                  }`}>
                    <Checkbox checked={on} onCheckedChange={() => toggle(selectedPeople, setPpl, p.id)} />
                    <div className="grid size-8 place-items-center rounded-full bg-zinc-200 text-[11px] font-semibold text-zinc-600 ring-1 ring-black/5">
                      {p.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.email}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Canal de envio</Label>
              <RadioGroup value={channel} onValueChange={(v) => setChannel(v as "email" | "link")} className="grid grid-cols-2 gap-3">
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg p-4 ring-1 ${channel === "email" ? "bg-accent/10 ring-accent" : "ring-black/10"}`}>
                  <RadioGroupItem value="email" className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium"><Mail className="size-4" /> Email</div>
                    <div className="text-xs text-muted-foreground">Enviamos o convite pelo email de cada avaliado.</div>
                  </div>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg p-4 ring-1 ${channel === "link" ? "bg-accent/10 ring-accent" : "ring-black/10"}`}>
                  <RadioGroupItem value="link" className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium"><Link2 className="size-4" /> Link</div>
                    <div className="text-xs text-muted-foreground">Gera um link único para cada avaliado.</div>
                  </div>
                </label>
              </RadioGroup>
            </div>
            {channel === "email" && (
              <div className="space-y-2">
                <Label>Mensagem do convite</Label>
                <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Prazo de resposta</Label>
              <Input type="date" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-sm">
            <Row label="Instrumentos" value={selectedInstruments.map((id) => INSTRUMENTS.find((i) => i.id === id)?.name).join(", ")} />
            <Row label="Destinatários" value={`${selectedPeople.length} pessoa(s)`} />
            <Row label="Canal" value={channel === "email" ? "Email" : "Link único"} />
            <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground ring-1 ring-black/5">
              Ao confirmar, os disparos ficarão registrados em <span className="font-medium text-foreground">Envios</span>.
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
            <Button
              onClick={() => {
                toast.success(`${selectedInstruments.length * selectedPeople.length} envio(s) criados (demo)`);
                nav({ to: "/envios" });
              }}
            >
              <Check className="size-4" /> Confirmar envio
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