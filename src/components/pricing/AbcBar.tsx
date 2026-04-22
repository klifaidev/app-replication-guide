import type { AggRow } from "@/lib/analytics";
import { formatBRL, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AbcBarProps {
  rows: AggRow[];
  variant: "hero" | "villain";
  limit?: number;
}

export function AbcBar({ rows, variant, limit = 5 }: AbcBarProps) {
  // Sort by margem (heroes desc, villains asc)
  const sorted = [...rows].sort((a, b) =>
    variant === "hero" ? b.margem - a.margem : a.margem - b.margem,
  );
  const top = sorted.slice(0, limit);
  const max = Math.max(...top.map((r) => Math.abs(r.margem)), 1);

  const color = variant === "hero" ? "bg-success" : "bg-destructive";
  const text = variant === "hero" ? "text-success" : "text-destructive";

  return (
    <ul className="space-y-3">
      {top.map((r, i) => {
        const pct = Math.abs(r.margem) / max;
        return (
          <li key={r.key} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground/90">{r.key}</span>
              <span className={cn("tabular-nums font-semibold", text)}>
                {formatBRL(r.margem, { compact: true })}
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-secondary/50">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-full transition-all", color)}
                style={{ width: `${pct * 100}%`, opacity: 0.85 }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Mg%: {formatPct(r.margemPct)}</span>
              <span>ROL: {formatBRL(r.rol, { compact: true })}</span>
            </div>
          </li>
        );
      })}
      {top.length === 0 && (
        <li className="text-center text-sm text-muted-foreground">Sem dados.</li>
      )}
    </ul>
  );
}
