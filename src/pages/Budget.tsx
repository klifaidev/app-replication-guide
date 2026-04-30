import { useMemo, useState } from "react";
import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { KpiCard } from "@/components/pricing/KpiCard";
import { EmptyState } from "@/components/pricing/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePricing } from "@/store/pricing";
import { useBudget } from "@/store/budget";
import { applyBudgetFilters } from "@/lib/budget";
import { applyFilters } from "@/lib/analytics";
import { formatBRL, formatPct, monthLabel } from "@/lib/format";
import { Target, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Dim = "canal" | "categoria" | "subcategoria" | "marca";

interface AggLine {
  key: string;
  realRol: number;
  realCm: number;
  realVol: number;
  budRol: number;
  budCm: number;
  budVol: number;
}

function pctVar(real: number, bud: number): number {
  if (!bud) return real ? (real > 0 ? Infinity : -Infinity) : 0;
  return (real - bud) / Math.abs(bud);
}

function VarBadge({ v, invert = false }: { v: number; invert?: boolean }) {
  if (!isFinite(v)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const positive = invert ? v < 0 : v >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
      )}
    >
      {v >= 0 ? "+" : ""}{(v * 100).toFixed(1)}%
    </span>
  );
}

export default function Budget() {
  const realRows = usePricing((s) => s.rows);
  const selectedPeriods = usePricing((s) => s.selectedPeriods);
  const filters = usePricing((s) => s.filters);
  const budgetRows = useBudget((s) => s.rows);

  const [dim, setDim] = useState<Dim>("canal");

  // Aplica os mesmos filtros do app (período + SKU + comercial) ao Real.
  const realFiltered = useMemo(
    () => applyFilters(realRows, filters, selectedPeriods),
    [realRows, filters, selectedPeriods],
  );
  // Budget: SKU completo + APENAS canalAjustado do bloco comercial.
  const budgetFiltered = useMemo(
    () => applyBudgetFilters(budgetRows, filters, selectedPeriods),
    [budgetRows, filters, selectedPeriods],
  );

  // Totais
  const totals = useMemo(() => {
    let realRol = 0, realCm = 0, realVol = 0;
    for (const r of realFiltered) { realRol += r.rol; realCm += r.contribMarginal; realVol += r.volumeKg; }
    let budRol = 0, budCm = 0, budVol = 0;
    for (const r of budgetFiltered) { budRol += r.receita; budCm += r.cm; budVol += r.volumeKg; }
    return { realRol, realCm, realVol, budRol, budCm, budVol };
  }, [realFiltered, budgetFiltered]);

  // Evolução mensal (todos os meses cobertos por qualquer base)
  const monthly = useMemo(() => {
    const map = new Map<string, { periodo: string; mes: number; ano: number; realRol: number; budRol: number; realCm: number; budCm: number }>();
    const ensure = (periodo: string, mes: number, ano: number) => {
      let x = map.get(periodo);
      if (!x) {
        x = { periodo, mes, ano, realRol: 0, budRol: 0, realCm: 0, budCm: 0 };
        map.set(periodo, x);
      }
      return x;
    };
    for (const r of realRows) {
      const x = ensure(r.periodo, r.mes, r.ano);
      x.realRol += r.rol;
      x.realCm += r.contribMarginal;
    }
    for (const r of budgetRows) {
      const x = ensure(r.periodo, r.mes, r.ano);
      x.budRol += r.receita;
      x.budCm += r.cm;
    }
    return Array.from(map.values())
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes)
      .map((x) => ({ ...x, label: monthLabel(x.mes, x.ano) }));
  }, [realRows, budgetRows]);

  // Agregação por dimensão
  const byDim = useMemo<AggLine[]>(() => {
    const map = new Map<string, AggLine>();
    const get = (k: string) => {
      let x = map.get(k);
      if (!x) {
        x = { key: k, realRol: 0, realCm: 0, realVol: 0, budRol: 0, budCm: 0, budVol: 0 };
        map.set(k, x);
      }
      return x;
    };
    for (const r of realFiltered) {
      const k = (r as any)[dim] ?? "—";
      const x = get(String(k));
      x.realRol += r.rol;
      x.realCm += r.contribMarginal;
      x.realVol += r.volumeKg;
    }
    for (const r of budgetFiltered) {
      const k = (r as any)[dim] ?? "—";
      const x = get(String(k));
      x.budRol += r.receita;
      x.budCm += r.cm;
      x.budVol += r.volumeKg;
    }
    return Array.from(map.values()).sort((a, b) => b.realRol + b.budRol - (a.realRol + a.budRol));
  }, [realFiltered, budgetFiltered, dim]);

  if (realRows.length === 0 && budgetRows.length === 0) {
    return (
      <>
        <Topbar title="Budget" subtitle="Real vs Orçamento" />
        <div className="px-8 py-6">
          <EmptyState message="Envie a base Real e a base Budget na aba Upload / Bases para começar." />
        </div>
      </>
    );
  }

  const rolVar = pctVar(totals.realRol, totals.budRol);
  const cmVar = pctVar(totals.realCm, totals.budCm);
  const volVar = pctVar(totals.realVol, totals.budVol);
  const realCmPct = totals.realRol ? totals.realCm / totals.realRol : 0;
  const budCmPct = totals.budRol ? totals.budCm / totals.budRol : 0;

  return (
    <>
      <Topbar title="Budget" subtitle="Comparativo Real vs Orçamento" />
      <div className="space-y-6 px-8 py-6">
        {/* KPIs */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Receita — Real vs Budget"
            value={formatBRL(totals.realRol, { compact: true })}
            subValue={`Budget ${formatBRL(totals.budRol, { compact: true })}`}
            delta={isFinite(rolVar) ? rolVar : undefined}
            accent="blue"
          />
          <KpiCard
            label="Contrib. Marginal"
            value={formatBRL(totals.realCm, { compact: true })}
            subValue={`Budget ${formatBRL(totals.budCm, { compact: true })}`}
            delta={isFinite(cmVar) ? cmVar : undefined}
            accent="violet"
          />
          <KpiCard
            label="Volume (kg)"
            value={`${(totals.realVol / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`}
            subValue={`Budget ${(totals.budVol / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`}
            delta={isFinite(volVar) ? volVar : undefined}
            accent="green"
          />
          <KpiCard
            label="% CM — Real vs Budget"
            value={formatPct(realCmPct)}
            subValue={`Budget ${formatPct(budCmPct)}`}
            delta={realCmPct - budCmPct}
            accent="amber"
          />
        </div>

        {/* Evolução mensal */}
        <GlassCard>
          <header className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">
                <Target className="mr-2 inline h-4 w-4 text-accent" /> Evolução mensal — Real vs Budget
              </h3>
              <p className="text-[11px] text-muted-foreground">Receita líquida por mês</p>
            </div>
            <Badge variant="secondary">{monthly.length} mês(es)</Badge>
          </header>
          {monthly.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(v) => formatBRL(v, { compact: true })}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => formatBRL(v, { compact: true })}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="budRol" name="Budget" fill="hsl(var(--accent))" opacity={0.55} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realRol" name="Real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </GlassCard>

        {/* Comparativo por dimensão */}
        <GlassCard>
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Atingimento por dimensão</h3>
              <p className="text-[11px] text-muted-foreground">Real vs Budget no período selecionado</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-secondary/30 p-1">
              {(["canal", "categoria", "subcategoria", "marca"] as Dim[]).map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant={dim === d ? "secondary" : "ghost"}
                  className="h-7 px-3 text-xs capitalize"
                  onClick={() => setDim(d)}
                >
                  {d}
                </Button>
              ))}
            </div>
          </header>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="capitalize">{dim}</TableHead>
                  <TableHead className="text-right">Receita Real</TableHead>
                  <TableHead className="text-right">Receita Budget</TableHead>
                  <TableHead className="text-right">Δ Receita</TableHead>
                  <TableHead className="text-right">CM Real</TableHead>
                  <TableHead className="text-right">CM Budget</TableHead>
                  <TableHead className="text-right">Δ CM</TableHead>
                  <TableHead className="text-right">Atingim. Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byDim.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                      Sem dados para o período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  byDim.map((row) => {
                    const dRol = pctVar(row.realRol, row.budRol);
                    const dCm = pctVar(row.realCm, row.budCm);
                    const ating = row.budRol ? row.realRol / row.budRol : 0;
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="font-medium">{row.key}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(row.realRol, { compact: true })}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatBRL(row.budRol, { compact: true })}</TableCell>
                        <TableCell className="text-right"><VarBadge v={dRol} /></TableCell>
                        <TableCell className="text-right tabular-nums">{formatBRL(row.realCm, { compact: true })}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatBRL(row.budCm, { compact: true })}</TableCell>
                        <TableCell className="text-right"><VarBadge v={dCm} /></TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {row.budRol ? `${(ating * 100).toFixed(1)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </GlassCard>

        {/* Heróis & ofensores vs Budget */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard>
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                <TrendingUp className="mr-2 inline h-4 w-4 text-success" /> Maiores Heróis vs Budget
              </h3>
              <span className="text-[11px] text-muted-foreground capitalize">por {dim}</span>
            </header>
            <ul className="space-y-1.5">
              {[...byDim]
                .filter((r) => r.budRol > 0)
                .sort((a, b) => pctVar(b.realRol, b.budRol) - pctVar(a.realRol, a.budRol))
                .slice(0, 5)
                .map((r) => (
                  <li key={r.key} className="flex items-center justify-between rounded-lg border border-border/30 bg-secondary/20 px-3 py-2">
                    <span className="text-sm font-medium truncate">{r.key}</span>
                    <VarBadge v={pctVar(r.realRol, r.budRol)} />
                  </li>
                ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                <TrendingDown className="mr-2 inline h-4 w-4 text-destructive" /> Maiores Ofensores vs Budget
              </h3>
              <span className="text-[11px] text-muted-foreground capitalize">por {dim}</span>
            </header>
            <ul className="space-y-1.5">
              {[...byDim]
                .filter((r) => r.budRol > 0)
                .sort((a, b) => pctVar(a.realRol, a.budRol) - pctVar(b.realRol, b.budRol))
                .slice(0, 5)
                .map((r) => (
                  <li key={r.key} className="flex items-center justify-between rounded-lg border border-border/30 bg-secondary/20 px-3 py-2">
                    <span className="text-sm font-medium truncate">{r.key}</span>
                    <VarBadge v={pctVar(r.realRol, r.budRol)} />
                  </li>
                ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </>
  );
}
