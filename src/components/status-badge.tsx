import { cn } from "@/lib/utils";
import type { SendStatus } from "@/lib/mock-data";
import { STATUS_LABEL } from "@/lib/mock-data";

const STYLES: Record<SendStatus, { bg: string; dot: string; text: string }> = {
  concluido: { bg: "bg-emerald-100", dot: "bg-emerald-500", text: "text-emerald-700" },
  em_andamento: { bg: "bg-amber-100", dot: "bg-amber-500", text: "text-amber-700" },
  pendente: { bg: "bg-zinc-200", dot: "bg-zinc-400", text: "text-zinc-600" },
  expirado: { bg: "bg-rose-100", dot: "bg-rose-500", text: "text-rose-700" },
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