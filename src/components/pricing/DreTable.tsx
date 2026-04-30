import { useMemo } from "react";
import type { PricingRow } from "@/lib/types";
import type { MonthInfo } from "@/lib/types";
import { formatBRL, formatNum, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePricing } from "@/store/pricing";

export type DrePeriodMode = "month" | "fy";

interface DreTableProps {
  rows: PricingRow[];
  months: MonthInfo[];
  mode?: DrePeriodMode;
}

interface PeriodCol {
  key: string;
  label: string;
  sublabel?: string;
}

interface PeriodAgg {
  volume: number;
  rol: number;
  cogs: number;
  custoVariavel: number;
  custoFixo: number;
  materiaPrima: number;
  embalagem: number;
  mod: number;
  cif: number;
  hasMP: boolean;
  hasEmb: boolean;
  hasMod: boolean;
  hasCif: boolean;
  frete: number;
  comissao: number;
  cm: number;
}

function aggregate(rs: PricingRow[]): PeriodAgg {
  const a: PeriodAgg = {
    volume: 0, rol: 0, cogs: 0,
    custoVariavel: 0, custoFixo: 0,
    materiaPrima: 0, embalagem: 0, mod: 0, cif: 0,
    hasMP: false, hasEmb: false, hasMod: false, hasCif: false,
    frete: 0, comissao: 0, cm: 0,
  };
  for (const r of rs) {
    a.volume += r.volumeKg;
    a.rol += r.rol;
    a.cogs += r.cogs;
    a.custoVariavel += r.custoVariavel ?? 0;
    a.custoFixo += r.custoFixo ?? 0;
    a.frete += r.frete ?? 0;
    a.comissao += r.comissao ?? 0;
    a.cm += r.contribMarginal;
    if (r.materiaPrima != null) { a.materiaPrima += r.materiaPrima; a.hasMP = true; }
    if (r.embalagem != null) { a.embalagem += r.embalagem; a.hasEmb = true; }
    if (r.mod != null) { a.mod += r.mod; a.hasMod = true; }
    if (r.cif != null) { a.cif += r.cif; a.hasCif = true; }
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
  { label: "Custo Variável", kind: "value", get: (a) => -Math.abs(a.custoVariavel) },
  { label: "Custo Variável (R$/Kg)", kind: "perKg", bold: true, get: (a) => -safe(Math.abs(a.custoVariavel), a.volume) },
  { label: "Matéria Prima Ajustado", kind: "value", get: (a) => a.hasMP ? -Math.abs(a.materiaPrima) : null },
  { label: "Embalagem Ajustado", kind: "value", get: (a) => a.hasEmb ? -Math.abs(a.embalagem) : null },
  { label: "Custo Fixo", kind: "value", get: (a) => -Math.abs(a.custoFixo) },
  { label: "Custo Fixo (R$/Kg)", kind: "perKg", bold: true, get: (a) => -safe(Math.abs(a.custoFixo), a.volume) },
  { label: "MOD", kind: "value", get: (a) => a.hasMod ? -Math.abs(a.mod) : null },
  { label: "CIF", kind: "value", get: (a) => a.hasCif ? -Math.abs(a.cif) : null },
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

export function DreTable({ rows, months, mode = "month" }: DreTableProps) {
  const selectedPeriods = usePricing((s) => s.selectedPeriods);

  // Filter months based on selectedPeriods (null = all)
  const filteredMonths = useMemo(() => {
    const sorted = [...months].sort((a, b) =>
      a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes,
    );
    if (selectedPeriods === null) return sorted;
    return sorted.filter((m) => selectedPeriods.includes(m.periodo));
  }, [months, selectedPeriods]);

  // Build columns + aggregations based on mode
  const { columns, aggsByCol } = useMemo(() => {
    const map = new Map<string, PeriodAgg>();
    const cols: PeriodCol[] = [];

    if (mode === "fy") {
      // Group selected months by fiscal year (Apr–Mar). Accumulated.
      const byFy = new Map<string, MonthInfo[]>();
      for (const m of filteredMonths) {
        const arr = byFy.get(m.fy) ?? [];
        arr.push(m);
        byFy.set(m.fy, arr);
      }
      // Sort FYs by their first month (chronologically)
      const fys = Array.from(byFy.entries()).sort((a, b) => {
        const ma = a[1][0], mb = b[1][0];
        return ma.ano !== mb.ano ? ma.ano - mb.ano : ma.mes - mb.mes;
      });
      for (const [fy, ms] of fys) {
        const periods = new Set(ms.map((m) => m.periodo));
        const rs = rows.filter((r) => periods.has(r.periodo));
        const first = ms[0];
        const last = ms[ms.length - 1];
        const sub =
          ms.length === 1
            ? first.label
            : `${first.label} → ${last.label} (${ms.length}m)`;
        cols.push({ key: fy, label: fy, sublabel: sub });
        map.set(fy, aggregate(rs));
      }
    } else {
      for (const m of filteredMonths) {
        const rs = rows.filter((r) => r.periodo === m.periodo);
        cols.push({ key: m.periodo, label: m.label, sublabel: m.fy });
        map.set(m.periodo, aggregate(rs));
      }
    }
    return { columns: cols, aggsByCol: map };
  }, [rows, filteredMonths, mode]);

  if (columns.length === 0) {
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
            {columns.map((c) => (
              <th
                key={c.key}
                className="border-b border-border/40 bg-card/40 px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                <div>{c.label}</div>
                {c.sublabel && (
                  <div className="mt-0.5 text-[9px] font-normal normal-case tracking-normal text-muted-foreground/70">
                    {c.sublabel}
                  </div>
                )}
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
              {columns.map((c) => {
                const a = aggsByCol.get(c.key)!;
                const v = line.get(a);
                const isNeg = typeof v === "number" && v < 0;
                return (
                  <td
                    key={c.key}
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
