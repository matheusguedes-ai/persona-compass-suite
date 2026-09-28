import { cn } from "@/lib/utils";
import type { SendStatus } from "@/lib/mock-data";
import { STATUS_LABEL } from "@/lib/mock-data";

// #285B — o par do claro fica igual; o do escuro troca o fundo pastel (uma mancha clara no meio da
// tela escura) por um tom translúcido, e o texto por um claro da mesma cor.
const STYLES: Record<SendStatus, { bg: string; dot: string; text: string }> = {
  concluido: { bg: "bg-emerald-100 dark:bg-emerald-500/15", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  em_andamento: { bg: "bg-amber-100 dark:bg-amber-500/15", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
  pendente: { bg: "bg-zinc-200 dark:bg-zinc-500/20", dot: "bg-zinc-400", text: "text-zinc-600 dark:text-zinc-300" },
  expirado: { bg: "bg-rose-100 dark:bg-rose-500/15", dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-300" },
};

export function StatusBadge({ status }: { status: SendStatus }) {
  const s = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        s.bg,
        s.text,
      )}
    >
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {STATUS_LABEL[status]}
    </span>
  );
}