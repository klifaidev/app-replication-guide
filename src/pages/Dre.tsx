import { DreTable, type DrePeriodMode } from "@/components/pricing/DreTable";
import { EmptyState } from "@/components/pricing/EmptyState";
import { GlassCard } from "@/components/pricing/GlassCard";
import { Topbar } from "@/components/pricing/Topbar";
import { SkuExcludePicker } from "@/components/pricing/SkuExcludePicker";
import { applyFilters } from "@/lib/analytics";
import { usePricing } from "@/store/pricing";
import { useMonthsInfo } from "@/store/selectors";
import { useMemo, useState } from "react";
import { Calendar, CalendarRange } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Dre() {
  const rows = usePricing((s) => s.rows);
  const filters = usePricing((s) => s.filters);
  const months = useMonthsInfo();
  const [mode, setMode] = useState<DrePeriodMode>("month");
  const [excludedSkus, setExcludedSkus] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const base = applyFilters(rows, filters, null);
    if (excludedSkus.length === 0) return base;
    const ex = new Set(excludedSkus);
    return base.filter((r) => !r.sku || !ex.has(r.sku));
  }, [rows, filters, excludedSkus]);

  // Pool de SKUs disponíveis no picker — respeita filtros ativos (mas não a própria exclusão)
  const pickerRows = useMemo(() => applyFilters(rows, filters, null), [rows, filters]);

  if (rows.length === 0) {
    return (
      <>
        <Topbar title="DRE" subtitle="Consolidado por período com filtros ativos" />
        <div className="px-8 py-6"><EmptyState /></div>
      </>
    );
  }

  return (
    <>
      <Topbar title="DRE" subtitle="Consolidado por período com filtros ativos" />
      <div className="space-y-6 px-8 py-6">
        <GlassCard>
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">DRE por Período</h2>
              <p className="text-xs text-muted-foreground">
                {mode === "month"
                  ? "Visão consolidada por mês — valores aplicam os filtros ativos."
                  : "Acumulado por ano fiscal (Abril → Março) — valores aplicam os filtros ativos."}
                {excludedSkus.length > 0 && (
                  <span className="ml-1 text-destructive">
                    · {excludedSkus.length} SKU{excludedSkus.length > 1 ? "s" : ""} excluído{excludedSkus.length > 1 ? "s" : ""} do cálculo
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <SkuExcludePicker
                rows={pickerRows}
                excluded={excludedSkus}
                onChange={setExcludedSkus}
              />
              <PeriodModeToggle mode={mode} onChange={setMode} />
            </div>
          </header>
          <DreTable rows={filtered} months={months} mode={mode} />
        </GlassCard>
      </div>
    </>
  );
}

function PeriodModeToggle({
  mode,
  onChange,
}: {
  mode: DrePeriodMode;
  onChange: (m: DrePeriodMode) => void;
}) {
  const opts: { v: DrePeriodMode; label: string; icon: typeof Calendar; hint: string }[] = [
    { v: "month", label: "Mensal", icon: Calendar, hint: "Coluna por mês" },
    { v: "fy", label: "FY acumulado", icon: CalendarRange, hint: "Acumulado por ano fiscal (Abr→Mar)" },
  ];
  return (
    <div className="inline-flex items-center rounded-lg border border-border/40 bg-secondary/30 p-0.5">
      {opts.map((o) => {
        const active = mode === o.v;
        const Icon = o.icon;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            title={o.hint}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
