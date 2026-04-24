import { DreTable } from "@/components/pricing/DreTable";
import { EmptyState } from "@/components/pricing/EmptyState";
import { GlassCard } from "@/components/pricing/GlassCard";
import { Topbar } from "@/components/pricing/Topbar";
import { applyFilters } from "@/lib/analytics";
import { usePricing } from "@/store/pricing";
import { useMonthsInfo } from "@/store/selectors";
import { useMemo } from "react";

export default function Dre() {
  const rows = usePricing((s) => s.rows);
  const filters = usePricing((s) => s.filters);
  const months = useMonthsInfo();

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
          <header className="mb-4">
            <h2 className="text-lg font-medium">DRE por Período</h2>
            <p className="text-xs text-muted-foreground">
              Visão consolidada por mês — valores aplicam os filtros ativos.
            </p>
          </header>
          <DreTable rows={filtered} months={months} />
        </GlassCard>
      </div>
    </>
  );
}