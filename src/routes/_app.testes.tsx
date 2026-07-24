import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { INSTRUMENTS, CATEGORY_LABEL, type TestCategory } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Send, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/testes")({
  head: () => ({
    meta: [
      { title: "Catálogo de Testes — Métrica Humana" },
      { name: "description", content: "Catálogo completo de instrumentos: DISC, Big Five, MBTI, Temperamentos, VAK, QI." },
      { property: "og:title", content: "Catálogo de Testes — Métrica Humana" },
      { property: "og:description", content: "Catálogo completo de instrumentos: DISC, Big Five, MBTI, Temperamentos, VAK, QI." },
    ],
  }),
  component: TestesPage,
});

const ACCENT: Record<string, string> = {
  rose: "bg-rose-100 text-rose-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  teal: "bg-teal-100 text-teal-700",
  violet: "bg-violet-100 text-violet-700",
  zinc: "bg-zinc-200 text-zinc-700",
};

function TestesPage() {
  const [filter, setFilter] = useState<"todos" | TestCategory>("todos");
  const list = INSTRUMENTS.filter((i) => filter === "todos" || i.category === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catálogo de Testes</h1>
        <p className="mt-1 text-sm text-muted-foreground">Instrumentos disponíveis para disparo.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["todos", "comportamental", "psicometrico", "cognitivo"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
              filter === f ? "bg-primary text-primary-foreground ring-primary" : "bg-muted text-muted-foreground ring-black/5 hover:bg-muted/70"
            }`}
          >
            {f === "todos" ? "Todos" : CATEGORY_LABEL[f]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <div key={t.id} className="flex flex-col rounded-xl bg-card p-1 ring-1 ring-black/5">
            <div className="flex aspect-[16/10] flex-col rounded-lg bg-muted p-6">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ACCENT[t.accent]}`}>
                  {CATEGORY_LABEL[t.category]}
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <Clock className="size-3" /> {t.durationMin}min
                </span>
              </div>
              <div className="mt-auto">
                <h3 className="text-xl font-medium tracking-tight">{t.name}</h3>
                <p className="mt-1 max-w-[38ch] text-sm text-muted-foreground">{t.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{t.shortName}</span>
              <Button size="sm" variant="ghost" onClick={() => toast.info(`Prévia de ${t.shortName} em breve`)}>
                <Send className="size-3" /> Enviar
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}