import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { KpiCard } from "@/components/pricing/KpiCard";
import { Waterfall } from "@/components/pricing/Waterfall";
import { EmptyState } from "@/components/pricing/EmptyState";
import { usePricing } from "@/store/pricing";
import { useFyList, useMonthsInfo } from "@/store/selectors";
import { applyFilters, calcPVM } from "@/lib/analytics";
import { exportPvmCsv } from "@/lib/exportCsv";
import { formatBRL } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ArrowRight, Calendar, CalendarDays, Download } from "lucide-react";
import { useEffect, useMemo } from "react";

export default function BridgePvm() {
  const rows = usePricing((s) => s.rows);
  const metric = usePricing((s) => s.metric);
  const filters = usePricing((s) => s.filters);
  const fyList = useFyList();
  const months = useMonthsInfo();
  const pvmMode = usePricing((s) => s.pvmMode);
  const pvmBase = usePricing((s) => s.pvmBase);
  const pvmComp = usePricing((s) => s.pvmComp);
  const setPvm = usePricing((s) => s.setPvm);
  const setPvmMode = usePricing((s) => s.setPvmMode);

  const options = useMemo(
    () =>
      pvmMode === "fy"
        ? fyList.map((fy) => ({ value: fy, label: fy }))
        : months.map((m) => ({ value: m.periodo, label: m.label })),
    [pvmMode, fyList, months],
  );

  // Defaults: pick first and last available option whenever mode/data changes
  // and current values are invalid.
  useEffect(() => {
    if (options.length < 2) return;
    const values = new Set(options.map((o) => o.value));
    const baseOk = pvmBase && values.has(pvmBase);
    const compOk = pvmComp && values.has(pvmComp);
    if (!baseOk || !compOk) {
      setPvm(options[0].value, options[options.length - 1].value);
    }
  }, [options, pvmBase, pvmComp, setPvm]);

  const filtered = useMemo(() => applyFilters(rows, filters, null), [rows, filters]);

  const result = useMemo(() => {
    if (!pvmBase || !pvmComp || pvmBase === pvmComp) return null;
    const labels =
      pvmMode === "month"
        ? {
            base: months.find((m) => m.periodo === pvmBase)?.label ?? pvmBase,
            comp: months.find((m) => m.periodo === pvmComp)?.label ?? pvmComp,
          }
        : undefined;
    return calcPVM(filtered, metric, pvmBase, pvmComp, pvmMode, labels);
  }, [filtered, metric, pvmBase, pvmComp, pvmMode, months]);

  if (rows.length === 0) {
    return (
      <>
        <Topbar title="Bridge PVM" />
        <div className="px-8 py-6"><EmptyState /></div>
      </>
    );
  }

  const notEnough =
    (pvmMode === "fy" && fyList.length < 2) || (pvmMode === "month" && months.length < 2);

  return (
    <>
      <Topbar title="Bridge PVM" subtitle="Decomposição da variação de Contribuição Marginal" />
      <div className="space-y-6 px-8 py-6">
        <GlassCard className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Comparar por
              </div>
              <ToggleGroup
                type="single"
                value={pvmMode}
                onValueChange={(v) => v && setPvmMode(v as "fy" | "month")}
                className="mt-1.5 inline-flex rounded-full border border-border/50 bg-secondary/30 p-1"
              >
                <ToggleGroupItem
                  value="fy"
                  className="h-8 gap-1.5 rounded-full px-4 text-xs data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=on]:shadow-sm"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Ano Fiscal
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="month"
                  className="h-8 gap-1.5 rounded-full px-4 text-xs data-[state=on]:bg-primary/20 data-[state=on]:text-primary data-[state=on]:shadow-sm"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  Mês
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {notEnough ? (
            <p className="text-sm text-muted-foreground">
              {pvmMode === "fy"
                ? `Carregue ao menos dois anos fiscais. Você tem: ${fyList.join(", ") || "—"}`
                : `Carregue ao menos dois meses para comparar.`}
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <PeriodSelect
                label={pvmMode === "fy" ? "Base (FY)" : "Mês base"}
                value={pvmBase}
                onChange={(v) => setPvm(v, pvmComp)}
                options={options}
              />
              <div className="flex h-10 items-center text-primary/60">
                <ArrowRight className="h-5 w-5" />
              </div>
              <PeriodSelect
                label={pvmMode === "fy" ? "Comparação (FY)" : "Mês de comparação"}
                value={pvmComp}
                onChange={(v) => setPvm(pvmBase, v)}
                options={options}
                excludeValue={pvmBase}
              />
              {pvmBase && pvmComp && pvmBase === pvmComp && (
                <p className="pb-2.5 text-xs text-warning">Selecione períodos diferentes.</p>
              )}
            </div>
          )}
        </GlassCard>

        {result && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <KpiCard label="Δ Volume" value={formatBRL(result.volume, { compact: true })} accent={result.volume >= 0 ? "green" : "red"} />
              <KpiCard label="Δ Preço" value={formatBRL(result.price, { compact: true })} accent={result.price >= 0 ? "green" : "red"} />
              <KpiCard label="Δ Custo Var." value={formatBRL(result.cost, { compact: true })} accent={result.cost >= 0 ? "green" : "red"} />
              <KpiCard label="Δ Frete" value={formatBRL(result.freight, { compact: true })} accent={result.freight >= 0 ? "green" : "red"} />
              <KpiCard label="Δ Comissão" value={formatBRL(result.commission, { compact: true })} accent={result.commission >= 0 ? "green" : "red"} />
              <KpiCard label="Δ Outros" value={formatBRL(result.others, { compact: true })} accent={result.others >= 0 ? "green" : "red"} />
            </div>

            <GlassCard glow="blue">
              <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium">
                    Bridge {result.baseLabel} → {result.currentLabel}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Variação total: {formatBRL(result.current - result.base, { compact: true })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportPvmCsv(result)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV (auditoria)
                </Button>
              </header>
              <Waterfall data={result} />
            </GlassCard>
          </>
        )}
      </div>
    </>
  );
}

function PeriodSelect({
  label,
  value,
  onChange,
  options,
  excludeValue,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  excludeValue?: string | null;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger className="h-10 w-48 border-border/50 bg-secondary/40 text-sm">
          <SelectValue placeholder="Escolha..." />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} disabled={o.value === excludeValue}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
