import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { DataTable } from "@/components/pricing/DataTable";
import { EmptyState } from "@/components/pricing/EmptyState";
import { usePricing } from "@/store/pricing";
import { applyFilters } from "@/lib/analytics";
import { formatBRL, formatNum, formatPct, monthLabel } from "@/lib/format";
import type { PricingRow } from "@/lib/types";
import { useMemo } from "react";

export default function Detalhe() {
  const rows = usePricing((s) => s.rows);
  const metric = usePricing((s) => s.metric);
  const filters = usePricing((s) => s.filters);
  const selected = usePricing((s) => s.selectedPeriods);

  const filtered = useMemo(() => applyFilters(rows, filters, selected), [rows, filters, selected]);

  const enriched = useMemo(
    () =>
      filtered.map((r) => ({
        ...r,
        _periodo: monthLabel(r.mes, r.ano),
        _margem: metric === "cm" ? r.contribMarginal : r.margemBruta,
        _margemPct: r.rol > 0 ? (metric === "cm" ? r.contribMarginal : r.margemBruta) / r.rol : 0,
      })),
    [filtered, metric],
  );

  if (rows.length === 0) return (<><Topbar title="Tabela Detalhe" /><div className="px-8 py-6"><EmptyState /></div></>);

  return (
    <>
      <Topbar title="Tabela Detalhe" subtitle={`${formatNum(filtered.length)} linhas filtradas`} />
      <div className="px-8 py-6">
        <GlassCard>
          <DataTable<typeof enriched[number]>
            rows={enriched}
            searchable
            searchKeys={["sku", "skuDesc", "cliente", "canal", "marca"] as (keyof PricingRow & string)[]}
            maxRows={300}
            columns={[
              { key: "_periodo", label: "Período", align: "left" },
              { key: "marca", label: "Marca", align: "left" },
              { key: "canal", label: "Canal", align: "left" },
              { key: "sku", label: "SKU", align: "left" },
              { key: "skuDesc", label: "Descrição", align: "left" },
              { key: "cliente", label: "Cliente", align: "left" },
              { key: "volumeKg", label: "Vol (kg)", align: "right", format: (v) => formatNum(Number(v), 1) },
              { key: "rol", label: "ROL", align: "right", format: (v) => formatBRL(Number(v), { compact: true }) },
              { key: "_margem", label: metric === "cm" ? "CM" : "MB", align: "right", format: (v) => formatBRL(Number(v), { compact: true }) },
              { key: "_margemPct", label: "Mg %", align: "right", format: (v) => formatPct(Number(v)) },
            ]}
          />
        </GlassCard>
      </div>
    </>
  );
}
