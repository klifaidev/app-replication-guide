import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { AbcBar } from "@/components/pricing/AbcBar";
import { DataTable } from "@/components/pricing/DataTable";
import { EmptyState } from "@/components/pricing/EmptyState";
import { usePricing } from "@/store/pricing";
import { aggregateBy, applyFilters } from "@/lib/analytics";
import { formatBRL, formatPct, formatTon } from "@/lib/format";
import { useMemo } from "react";

export default function Abc() {
  const rows = usePricing((s) => s.rows);
  const metric = usePricing((s) => s.metric);
  const filters = usePricing((s) => s.filters);
  const selected = usePricing((s) => s.selectedPeriods);

  const filtered = useMemo(() => applyFilters(rows, filters, selected), [rows, filters, selected]);
  const bySku = useMemo(() => aggregateBy(filtered, metric, (r) => r.skuDesc || r.sku || "—"), [filtered, metric]);

  if (rows.length === 0) return (<><Topbar title="ABC Heróis & Ofensores" /><div className="px-8 py-6"><EmptyState /></div></>);

  return (
    <>
      <Topbar title="ABC Heróis & Ofensores" subtitle="Top SKUs por contribuição de margem" />
      <div className="space-y-6 px-8 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard glow="green">
            <h3 className="mb-4 text-sm font-medium text-success">🏆 Heróis</h3>
            <AbcBar rows={bySku} variant="hero" limit={5} />
          </GlassCard>
          <GlassCard glow="red">
            <h3 className="mb-4 text-sm font-medium text-destructive">⚠️ Ofensores</h3>
            <AbcBar rows={bySku} variant="villain" limit={5} />
          </GlassCard>
        </div>

        <GlassCard>
          <h3 className="mb-3 text-sm font-medium">Ranking completo de SKUs</h3>
          <DataTable
            rows={bySku as unknown as Record<string, unknown>[]}
            searchable
            searchKeys={["key"]}
            columns={[
              { key: "key", label: "SKU", align: "left", format: (v) => <span className="truncate font-medium">{String(v)}</span> },
              { key: "rol", label: "ROL", align: "right", format: (v) => formatBRL(Number(v), { compact: true }) },
              { key: "margem", label: metric === "cm" ? "CM" : "MB", align: "right", format: (v) => formatBRL(Number(v), { compact: true }) },
              { key: "margemPct", label: "Mg %", align: "right", format: (v) => formatPct(Number(v)) },
              { key: "volumeKg", label: "Volume", align: "right", format: (v) => formatTon(Number(v)) },
            ]}
          />
        </GlassCard>
      </div>
    </>
  );
}
