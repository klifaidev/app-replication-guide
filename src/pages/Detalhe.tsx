import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { EmptyState } from "@/components/pricing/EmptyState";
import { PivotBuilder } from "@/components/pricing/PivotBuilder";
import { usePricing } from "@/store/pricing";
import { useBudget } from "@/store/budget";
import { applyFilters } from "@/lib/analytics";
import { applyBudgetFilters } from "@/lib/budget";
import { useMemo } from "react";

export default function Detalhe() {
  const realRows = usePricing((s) => s.rows);
  const filters = usePricing((s) => s.filters);
  const selected = usePricing((s) => s.selectedPeriods);
  const budgetRows = useBudget((s) => s.rows);

  const filteredReal = useMemo(
    () => applyFilters(realRows, filters, selected),
    [realRows, filters, selected],
  );
  const filteredBudget = useMemo(
    () => applyBudgetFilters(budgetRows, filters, selected),
    [budgetRows, filters, selected],
  );

  if (realRows.length === 0 && budgetRows.length === 0) {
    return (
      <>
        <Topbar title="Tabela Dinâmica" />
        <div className="px-8 py-6">
          <EmptyState />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar
        title="Tabela Dinâmica"
        subtitle={`${filteredReal.length.toLocaleString("pt-BR")} linhas Real · ${filteredBudget.length.toLocaleString("pt-BR")} linhas Budget`}
      />
      <div className="px-8 py-6">
        <GlassCard>
          <PivotBuilder realRows={filteredReal} budgetRows={filteredBudget} />
        </GlassCard>
      </div>
    </>
  );
}
