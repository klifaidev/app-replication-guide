import { DreTable, type DrePeriodMode } from "@/components/pricing/DreTable";
import { EmptyState } from "@/components/pricing/EmptyState";
import { GlassCard } from "@/components/pricing/GlassCard";
import { Topbar } from "@/components/pricing/Topbar";
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

  const filtered = useMemo(() => applyFilters(rows, filters, null), [rows, filters]);

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
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">DRE por Período</h2>
              <p className="text-xs text-muted-foreground">
                {mode === "month"
                  ? "Visão consolidada por mês — valores aplicam os filtros ativos."
                  : "Acumulado por ano fiscal (Abril → Março) — valores aplicam os filtros ativos."}
              </p>
            </div>
            <PeriodModeToggle mode={mode} onChange={setMode} />
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
