import { useMemo } from "react";
import type { PricingRow } from "@/lib/types";
import type { MonthInfo } from "@/lib/types";
import { formatBRL, formatNum, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePricing } from "@/store/pricing";

interface DreTableProps {
  rows: PricingRow[];
  months: MonthInfo[];
}

interface PeriodAgg {
  volume: number;
  rol: number;
  cogs: number;
  materiaPrima: number;
  embalagem: number;
  hasMP: boolean;
  hasEmb: boolean;
  frete: number;
  comissao: number;
  cm: number;
}

function aggregate(rs: PricingRow[]): PeriodAgg {
  const a: PeriodAgg = {
    volume: 0, rol: 0, cogs: 0,
    materiaPrima: 0, embalagem: 0,
    hasMP: false, hasEmb: false,
    frete: 0, comissao: 0, cm: 0,
  };
  for (const r of rs) {
    a.volume += r.volumeKg;
    a.rol += r.rol;
    a.cogs += r.cogs;
    a.frete += r.frete ?? 0;
    a.comissao += r.comissao ?? 0;
    a.cm += r.contribMarginal;
    if (r.materiaPrima != null) { a.materiaPrima += r.materiaPrima; a.hasMP = true; }
    if (r.embalagem != null) { a.embalagem += r.embalagem; a.hasEmb = true; }
  }
  return a;
}

type RowKind = "value" | "perKg" | "pct" | "kg";

interface DreLine {
  label: string;
  kind: RowKind;
  bold?: boolean;
  get: (a: PeriodAgg) => number | null;
}

const safe = (n: number, d: number) => (d > 0 ? n / d : 0);

const LINES: DreLine[] = [
  { label: "Volume (Kg)", kind: "kg", bold: true, get: (a) => a.volume },
  { label: "Receita Líquida", kind: "value", get: (a) => a.rol },
  { label: "ROL (R$/Kg)", kind: "perKg", bold: true, get: (a) => safe(a.rol, a.volume) },
  { label: "Custo Variável", kind: "value", get: (a) => -Math.abs(a.cogs) },
  { label: "Custo Variável (R$/Kg)", kind: "perKg", bold: true, get: (a) => -safe(Math.abs(a.cogs), a.volume) },
  { label: "Matéria Prima Ajustado", kind: "value", get: (a) => a.hasMP ? -Math.abs(a.materiaPrima) : null },
  { label: "Embalagem Ajustado", kind: "value", get: (a) => a.hasEmb ? -Math.abs(a.embalagem) : null },
  { label: "Frete sobre Vendas Ajustado", kind: "value", get: (a) => -Math.abs(a.frete) },
  { label: "Frete (R$/Kg)", kind: "perKg", get: (a) => -safe(Math.abs(a.frete), a.volume) },
  { label: "Comissão Repres Ajustado", kind: "value", get: (a) => -Math.abs(a.comissao) },
  { label: "Comissão (%/ROL)", kind: "pct", get: (a) => -safe(Math.abs(a.comissao), a.rol) },
  { label: "Comissão (R$/Kg)", kind: "perKg", get: (a) => -safe(Math.abs(a.comissao), a.volume) },
  { label: "Contrib. Marginal", kind: "value", bold: true, get: (a) => a.cm },
  { label: "Contrib. Marginal (%/ROL)", kind: "pct", bold: true, get: (a) => safe(a.cm, a.rol) },
  { label: "Contrib. Marginal (R$/Kg)", kind: "perKg", bold: true, get: (a) => safe(a.cm, a.volume) },
];

function fmt(value: number | null, kind: RowKind) {
  if (value == null) return <span className="text-muted-foreground/50">—</span>;
  if (kind === "pct") return formatPct(value);
  if (kind === "perKg") return formatBRL(value, { digits: 2 });
  if (kind === "kg") return `${formatNum(value, 0)} kg`;
  if (Math.abs(value) >= 1_000_000) return formatBRL(value, { compact: true });
  return formatBRL(value, { digits: 0 });
}

export function DreTable({ rows, months }: DreTableProps) {
  const selectedPeriods = usePricing((s) => s.selectedPeriods);
  
  // Filter months based on selectedPeriods (null = all)
  const filteredMonths = useMemo(() => {
    const sorted = [...months].sort((a, b) =>
      a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes,
    );
    if (selectedPeriods === null) return sorted;
    return sorted.filter((m) => selectedPeriods.includes(m.periodo));
  }, [months, selectedPeriods]);

  const aggsByPeriod = useMemo(() => {
    const map = new Map<string, PeriodAgg>();
    for (const m of filteredMonths) {
      const rs = rows.filter((r) => r.periodo === m.periodo);
      map.set(m.periodo, aggregate(rs));
    }
    return map;
  }, [rows, filteredMonths]);

  if (filteredMonths.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum período disponível para montar o DRE.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[260px] border-b border-border/40 bg-card/80 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
              Valores
            </th>
            {filteredMonths.map((m) => (
              <th
                key={m.periodo}
                className="border-b border-border/40 bg-card/40 px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                {m.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINES.map((line, idx) => (
            <tr
              key={line.label}
              className={cn(
                "transition-colors hover:bg-secondary/20",
                idx % 2 === 1 && "bg-secondary/10",
              )}
            >
              <td
                className={cn(
                  "sticky left-0 z-[1] border-b border-border/20 bg-card/80 px-4 py-2 text-left backdrop-blur",
                  line.bold ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {line.label}
              </td>
              {sortedMonths.map((m) => {
                const a = aggsByPeriod.get(m.periodo)!;
                const v = line.get(a);
                const isNeg = typeof v === "number" && v < 0;
                return (
                  <td
                    key={m.periodo}
                    className={cn(
                      "border-b border-border/20 px-3 py-2 text-right tabular-nums",
                      line.bold && "font-semibold",
                      isNeg && "text-destructive",
                    )}
                  >
                    {fmt(v, line.kind)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
