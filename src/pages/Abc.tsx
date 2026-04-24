import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { AbcBar } from "@/components/pricing/AbcBar";
import { DataTable } from "@/components/pricing/DataTable";
import { EmptyState } from "@/components/pricing/EmptyState";
import { Button } from "@/components/ui/button";
import { usePricing } from "@/store/pricing";
import { aggregateBy, applyFilters } from "@/lib/analytics";
import { formatBRL, formatPct, formatTon } from "@/lib/format";
import { useMemo, useState } from "react";

export default function Abc() {
  const rows = usePricing((s) => s.rows);
  const metric = usePricing((s) => s.metric);
  const filters = usePricing((s) => s.filters);
  const selected = usePricing((s) => s.selectedPeriods);
  const [rankingSort, setRankingSort] = useState<"margem" | "volume">("margem");

  const filtered = useMemo(() => applyFilters(rows, filters, selected), [rows, filters, selected]);
  const bySku = useMemo(() => aggregateBy(filtered, metric, (r) => r.skuDesc || r.sku || "—"), [filtered, metric]);
  const rankingRows = useMemo(
    () =>
      [...bySku].sort((a, b) =>
        rankingSort === "margem" ? b.margem - a.margem : b.volumeKg - a.volumeKg,
      ),
    [bySku, rankingSort],
  );

  if (rows.length === 0) return (<><Topbar title="ABC Heróis & Ofensores" /><div className="px-8 py-6"><EmptyState /></div></>);

  return (
    <>
      <Topbar title="ABC Heróis" subtitle="Top SKUs por margem e volume" />
      <div className="space-y-6 px-8 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard glow="green">
            <h3 className="mb-4 text-sm font-medium text-success">🏆 Top 5 Heróis em Margem</h3>
            <AbcBar rows={bySku} variant="hero" limit={5} />
          </GlassCard>
          <GlassCard glow="green">
            <h3 className="mb-4 text-sm font-medium text-success">📦 Top 5 Heróis em Volume</h3>
            <AbcBar rows={bySku} variant="hero" limit={5} sortBy="volume" />
          </GlassCard>
        </div>

        <GlassCard>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-medium">Ranking completo de SKUs</h3>
            <div className="flex items-center gap-2">
              <Button
                variant={rankingSort === "margem" ? "default" : "outline"}
                size="sm"
                onClick={() => setRankingSort("margem")}
              >
                Ordenar por margem
              </Button>
              <Button
                variant={rankingSort === "volume" ? "default" : "outline"}
                size="sm"
                onClick={() => setRankingSort("volume")}
              >
                Ordenar por volume
              </Button>
            </div>
          </div>
          <DataTable
            rows={rankingRows as unknown as Record<string, unknown>[]}
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
