import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { BubbleChart } from "@/components/pricing/BubbleChart";
import { DataTable } from "@/components/pricing/DataTable";
import { EmptyState } from "@/components/pricing/EmptyState";
import { usePricing } from "@/store/pricing";
import { aggregateBy, applyFilters } from "@/lib/analytics";
import { formatBRL, formatPct, formatTon } from "@/lib/format";
import { useMemo } from "react";

export default function Canais() {
  const rows = usePricing((s) => s.rows);
  const metric = usePricing((s) => s.metric);
  const filters = usePricing((s) => s.filters);
  const selected = usePricing((s) => s.selectedPeriods);

  const filtered = useMemo(() => applyFilters(rows, filters, selected), [rows, filters, selected]);
  const byCanal = useMemo(() => aggregateBy(filtered, metric, (r) => r.canalAjustado || "Sem canal"), [filtered, metric]);

  if (rows.length === 0) return (<><Topbar title="Canais" /><div className="px-8 py-6"><EmptyState /></div></>);

  return (
    <>
      <Topbar title="Canais" subtitle="Margem, volume e rentabilidade por canal" />
      <div className="space-y-6 px-8 py-6">
        <GlassCard glow="blue">
          <h2 className="mb-3 text-lg font-medium">Mapa de Canais</h2>
          <BubbleChart data={byCanal} height={420} />
        </GlassCard>

        <GlassCard>
          <h3 className="mb-3 text-sm font-medium">Detalhe por Canal</h3>
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
