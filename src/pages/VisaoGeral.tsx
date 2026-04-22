import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { KpiCard } from "@/components/pricing/KpiCard";
import { BubbleChart } from "@/components/pricing/BubbleChart";
import { AbcBar } from "@/components/pricing/AbcBar";
import { DataTable } from "@/components/pricing/DataTable";
import { EmptyState } from "@/components/pricing/EmptyState";
import { usePricing } from "@/store/pricing";
import { aggregateBy, applyFilters, computeKPIs } from "@/lib/analytics";
import { formatBRL, formatNum, formatPct, formatTon } from "@/lib/format";
import { useMemo } from "react";

export default function VisaoGeral() {
  const rows = usePricing((s) => s.rows);
  const metric = usePricing((s) => s.metric);
  const filters = usePricing((s) => s.filters);
  const selected = usePricing((s) => s.selectedPeriods);

  const filtered = useMemo(() => applyFilters(rows, filters, selected), [rows, filters, selected]);
  const kpis = useMemo(() => computeKPIs(filtered, metric), [filtered, metric]);
  const byCanal = useMemo(() => aggregateBy(filtered, metric, (r) => r.canal || "Sem canal"), [filtered, metric]);
  const bySku = useMemo(() => aggregateBy(filtered, metric, (r) => r.skuDesc || r.sku || "—"), [filtered, metric]);

  if (rows.length === 0) {
    return (
      <>
        <Topbar title="Visão Geral" />
        <div className="px-8 py-6">
          <EmptyState />
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Visão Geral" subtitle="Indicadores e composição agregada" />
      <div className="space-y-6 px-8 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="ROL Total" value={formatBRL(kpis.rol, { compact: true })} subValue={formatBRL(kpis.rol)} accent="blue" glow="blue" />
          <KpiCard
            label={metric === "cm" ? "Contrib. Marginal" : "Margem Bruta"}
            value={formatBRL(kpis.margem, { compact: true })}
            subValue={formatPct(kpis.margemPct)}
            accent="green"
            glow="green"
          />
          <KpiCard label="Volume" value={formatTon(kpis.volumeKg)} subValue={`${formatNum(kpis.volumeKg)} kg`} accent="amber" />
          <KpiCard label="SKUs ativos" value={formatNum(kpis.skus)} accent="violet" />
        </div>

        <GlassCard>
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium">Canais — Margem % × Share Volume</h2>
              <p className="text-xs text-muted-foreground">Tamanho da bolha = participação na receita</p>
            </div>
          </header>
          <BubbleChart data={byCanal} />
        </GlassCard>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard glow="green">
            <h3 className="mb-4 text-sm font-medium text-success">🏆 Heróis (Top 5 SKUs)</h3>
            <AbcBar rows={bySku} variant="hero" />
          </GlassCard>
          <GlassCard glow="red">
            <h3 className="mb-4 text-sm font-medium text-destructive">⚠️ Ofensores (Top 5 SKUs)</h3>
            <AbcBar rows={bySku} variant="villain" />
          </GlassCard>
        </div>

        <GlassCard>
          <h3 className="mb-3 text-sm font-medium">Performance por Canal</h3>
          <DataTable
            rows={byCanal as unknown as Record<string, unknown>[]}
            columns={[
              { key: "key", label: "Canal", align: "left", format: (v) => <span className="font-medium">{String(v)}</span> },
              { key: "rol", label: "ROL", align: "right", format: (v) => formatBRL(Number(v), { compact: true }) },
              { key: "margem", label: metric === "cm" ? "CM" : "MB", align: "right", format: (v) => formatBRL(Number(v), { compact: true }) },
              { key: "margemPct", label: "Mg %", align: "right", format: (v) => formatPct(Number(v)) },
              { key: "volumeKg", label: "Volume", align: "right", format: (v) => formatTon(Number(v)) },
              { key: "rolPorKg", label: "ROL/kg", align: "right", format: (v) => formatBRL(Number(v), { digits: 2 }) },
            ]}
          />
        </GlassCard>
      </div>
    </>
  );
}
