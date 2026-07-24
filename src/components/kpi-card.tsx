import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  hintTone?: "positive" | "warn" | "muted";
}

export function KpiCard({ label, value, hint, hintTone = "muted" }: KpiCardProps) {
  return (
    <div className="rounded-xl bg-card p-5 ring-1 ring-black/5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <p className="mt-1 text-2xl font-medium tracking-tight">{value}</p>
      {hint && (
        <div
          className={cn(
            "mt-2 text-[11px] font-medium",
            hintTone === "positive" && "text-emerald-600",
            hintTone === "warn" && "text-amber-600",
            hintTone === "muted" && "text-muted-foreground",
          )}
        >
          {hint}
        </div>
      )}
    </div>
  );
}