import type { AggRow } from "@/lib/analytics";
import { formatBRL, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface AbcBarProps {
  rows: AggRow[];
  variant: "hero" | "villain";
  limit?: number;
  sortBy?: "margem" | "volume";
}

export function AbcBar({ rows, variant, limit = 5, sortBy = "margem" }: AbcBarProps) {
  const sorted = [...rows].sort((a, b) => {
    if (sortBy === "volume") return b.volumeKg - a.volumeKg;
    return variant === "hero" ? b.margem - a.margem : a.margem - b.margem;
  });
  const top = sorted.slice(0, limit);
  const max = Math.max(...top.map((r) => (sortBy === "volume" ? Math.abs(r.volumeKg) : Math.abs(r.margem))), 1);

  const color = variant === "hero" ? "bg-success" : "bg-destructive";
  const text = variant === "hero" ? "text-success" : "text-destructive";

  return (
    <ul className="space-y-3">
      {top.map((r, i) => {
        const value = sortBy === "volume" ? r.volumeKg : r.margem;
        const pct = Math.abs(value) / max;
        return (
          <li key={r.key} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-medium text-foreground/90">{r.key}</span>
              <span className={cn("tabular-nums font-semibold", text)}>
                {sortBy === "volume" ? `${(r.volumeKg / 1000).toFixed(1)} t` : formatBRL(r.margem, { compact: true })}
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
              <span>{sortBy === "volume" ? `ROL: ${formatBRL(r.rol, { compact: true })}` : `Vol: ${(r.volumeKg / 1000).toFixed(1)} t`}</span>
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
