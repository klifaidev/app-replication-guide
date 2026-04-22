import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { KpiCard } from "@/components/pricing/KpiCard";
import { Waterfall } from "@/components/pricing/Waterfall";
import { EmptyState } from "@/components/pricing/EmptyState";
import { usePricing } from "@/store/pricing";
import { applyFilters, calcPVM } from "@/lib/analytics";
import { formatBRL } from "@/lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo } from "react";

export default function BridgePvm() {
  const rows = usePricing((s) => s.rows);
  const metric = usePricing((s) => s.metric);
  const filters = usePricing((s) => s.filters);
  const fyList = useFyList();
  const pvmBase = usePricing((s) => s.pvmBase);
  const pvmComp = usePricing((s) => s.pvmComp);
  const setPvm = usePricing((s) => s.setPvm);

  // Defaults
  useEffect(() => {
    if (fyList.length >= 2 && (!pvmBase || !pvmComp)) {
      setPvm(fyList[0], fyList[fyList.length - 1]);
    }
  }, [fyList, pvmBase, pvmComp, setPvm]);

  const filtered = useMemo(() => applyFilters(rows, filters, null), [rows, filters]);

  const result = useMemo(() => {
    if (!pvmBase || !pvmComp) return null;
    return calcPVM(filtered, metric, pvmBase, pvmComp);
  }, [filtered, metric, pvmBase, pvmComp]);

  if (rows.length === 0) {
    return (
      <>
        <Topbar title="Bridge PVM" />
        <div className="px-8 py-6"><EmptyState /></div>
      </>
    );
  }

  if (fyList.length < 2) {
    return (
      <>
        <Topbar title="Bridge PVM" />
        <div className="px-8 py-6">
          <GlassCard className="py-12 text-center">
            <h3 className="text-lg font-medium">Carregue ao menos dois anos fiscais</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              O Bridge PVM compara dois FYs (abr–mar). Você tem: {fyList.join(", ") || "—"}
            </p>
          </GlassCard>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Bridge PVM" subtitle="Decomposição da variação de margem (Volume · Preço · Custo · Mix)" />
      <div className="space-y-6 px-8 py-6">
        <GlassCard className="flex flex-wrap items-end gap-4">
          <FySelect label="Base (FY)" value={pvmBase} onChange={(v) => setPvm(v, pvmComp)} options={fyList} />
          <span className="pb-2 text-2xl text-muted-foreground">→</span>
          <FySelect label="Comparação (FY)" value={pvmComp} onChange={(v) => setPvm(pvmBase, v)} options={fyList} />
        </GlassCard>

        {result && (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard label="Δ Volume" value={formatBRL(result.volume, { compact: true })} accent={result.volume >= 0 ? "green" : "red"} />
              <KpiCard label="Δ Preço" value={formatBRL(result.price, { compact: true })} accent={result.price >= 0 ? "green" : "red"} />
              <KpiCard label="Δ Custo" value={formatBRL(result.cost, { compact: true })} accent={result.cost >= 0 ? "green" : "red"} />
              <KpiCard label="Δ Mix" value={formatBRL(result.mix, { compact: true })} accent={result.mix >= 0 ? "green" : "red"} />
            </div>

            <GlassCard glow="blue">
              <header className="mb-4">
                <h2 className="text-lg font-medium">Bridge {result.baseLabel} → {result.currentLabel}</h2>
                <p className="text-xs text-muted-foreground">
                  Variação total: {formatBRL(result.current - result.base, { compact: true })}
                </p>
              </header>
              <Waterfall data={result} />
            </GlassCard>
          </>
        )}
      </div>
    </>
  );
}

function FySelect({ label, value, onChange, options }: { label: string; value: string | null; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-44 border-border/50 bg-secondary/40 text-sm">
          <SelectValue placeholder="Escolha..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
