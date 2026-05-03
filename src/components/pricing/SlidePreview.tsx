// Slide live preview — renderiza uma prévia compacta do conteúdo do slide
// selecionado em Slides (Beta), respeitando filtros/configuração local.
import { useMemo } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Waterfall } from "./Waterfall";
import { applyFilters, calcPVM } from "@/lib/analytics";
import { computeBudgetEvoMonthly, isItemReady, metaOf, type SlideItem } from "@/lib/slidesFlow";
import { monthLabel } from "@/lib/format";
import { usePricing } from "@/store/pricing";
import { useBudget } from "@/store/budget";
import { AlertCircle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const fmtCm = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
const fmtKg = (v: number | null) =>
  v == null ? "—" : `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}/kg`;
const fmtTons = (v: number) => `${Math.round(v).toLocaleString("pt-BR")} t`;

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 bg-secondary/10 px-4 text-center">
      <AlertCircle className="h-5 w-5 text-muted-foreground/60" />
      <p className="text-[11px] text-muted-foreground">{message}</p>
    </div>
  );
}

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-gradient-to-br from-card to-secondary/20 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 bg-background/40 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Eye className="h-3 w-3" /> Prévia · {label}
        </span>
        <span className="text-[9px] text-muted-foreground/60">aprox. 16:9</span>
      </div>
      <div className="aspect-[16/9] w-full bg-card p-3">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cover preview
// ---------------------------------------------------------------------------
function CoverPreview({ item }: { item: Extract<SlideItem, { kind: "cover" }> }) {
  const { title, subtitle, variant } = item.config;
  const isCover = variant === "cover";
  return (
    <Frame label="Capa">
      <div
        className={cn(
          "flex h-full flex-col items-start justify-end gap-1 rounded-md p-4",
          isCover ? "bg-[#E63946] text-white" : "border border-border/40 bg-background text-foreground",
        )}
      >
        <div className={cn("text-[8px] font-semibold uppercase tracking-[0.2em]", isCover ? "text-white/70" : "text-muted-foreground")}>
          {isCover ? "Capa" : "Divisor"}
        </div>
        <h2 className={cn("font-semibold leading-tight", title.length > 40 ? "text-base" : "text-lg")}>
          {title || "Título do slide"}
        </h2>
        {subtitle && (
          <p className={cn("text-[10px]", isCover ? "text-white/80" : "text-muted-foreground")}>
            {subtitle}
          </p>
        )}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Bridge PVM preview
// ---------------------------------------------------------------------------
function BridgePvmPreview({ item }: { item: Extract<SlideItem, { kind: "bridge_pvm" }> }) {
  const pricingRows = usePricing((s) => s.rows);
  const metric = usePricing((s) => s.metric);
  const ready = isItemReady(item);

  const pvm = useMemo(() => {
    if (!ready.ok || !item.config.base || !item.config.comp) return null;
    const filtered = applyFilters(pricingRows, item.config.filters, null);
    const labels = item.config.mode === "month"
      ? {
          base: (() => {
            const r = filtered.find((x) => x.periodo === item.config.base);
            return r ? monthLabel(r.mes, r.ano) : item.config.base ?? "";
          })(),
          comp: (() => {
            const r = filtered.find((x) => x.periodo === item.config.comp);
            return r ? monthLabel(r.mes, r.ano) : item.config.comp ?? "";
          })(),
        }
      : undefined;
    try {
      return calcPVM(filtered, metric, item.config.base, item.config.comp, item.config.mode, labels);
    } catch {
      return null;
    }
  }, [pricingRows, metric, item.config, ready.ok]);

  if (!ready.ok) return <Frame label="Bridge PVM"><Empty message={ready.reason ?? "Configure o slide."} /></Frame>;
  if (!pvm) return <Frame label="Bridge PVM"><Empty message="Sem dados para os períodos selecionados." /></Frame>;

  return (
    <Frame label={`Bridge · ${pvm.baseLabel} → ${pvm.currentLabel}`}>
      <div className="h-full w-full">
        <Waterfall data={pvm} height={180} />
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Budget Evo preview — mini composed chart (CM Abs) + mini bar (Volume)
// ---------------------------------------------------------------------------
function BudgetEvoPreview({ item }: { item: Extract<SlideItem, { kind: "budget_evo" }> }) {
  const budgetRows = useBudget((s) => s.rows);
  const data = useMemo(
    () => computeBudgetEvoMonthly(budgetRows, item.config.filters, item.config.start, item.config.end),
    [budgetRows, item.config.filters, item.config.start, item.config.end],
  );

  if (data.length === 0) {
    return <Frame label="Budget Evolutivo"><Empty message="Sem dados Budget para o range escolhido." /></Frame>;
  }

  const accumGap = data
    .filter((m) => m.realCm !== 0 || m.realVol !== 0)
    .reduce(
      (a, m) => ({ cm: a.cm + (m.realCm - m.budCm), vol: a.vol + (m.realVol - m.budVol) }),
      { cm: 0, vol: 0 },
    );

  return (
    <Frame label={`Budget Evolutivo · ${data[0].label} → ${data[data.length - 1].label}`}>
      <div className="grid h-full grid-cols-2 gap-2">
        {/* CM Abs */}
        <div className="flex h-full flex-col rounded-md border border-border/30 bg-background/40 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">CM Abs</span>
            <span className={cn("text-[9px] font-semibold tabular-nums", accumGap.cm >= 0 ? "text-success" : "text-destructive")}>
              {accumGap.cm >= 0 ? "+" : ""}{fmtCm(accumGap.cm)}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="prevCmArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E63946" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#E63946" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => fmtCm(v)} contentStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="realCm" stroke="none" fill="url(#prevCmArea)" connectNulls />
                <Line type="monotone" dataKey="budCm" stroke="hsl(var(--foreground))" strokeWidth={1.2} strokeDasharray="4 3" dot={false} connectNulls />
                <Line type="monotone" dataKey="realCm" stroke="#E63946" strokeWidth={1.8} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Volume */}
        <div className="flex h-full flex-col rounded-md border border-border/30 bg-background/40 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Volume</span>
            <span className={cn("text-[9px] font-semibold tabular-nums", accumGap.vol >= 0 ? "text-success" : "text-destructive")}>
              {accumGap.vol >= 0 ? "+" : ""}{fmtTons(accumGap.vol)}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="2 4" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={28} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v: number) => fmtTons(v)} contentStyle={{ fontSize: 10 }} />
                <Bar dataKey="realVol" fill="#E63946" radius={[2, 2, 0, 0]} />
                <Bar dataKey="budVol" fill="hsl(var(--foreground) / 0.4)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------
export function SlidePreview({ item }: { item: SlideItem }) {
  switch (item.kind) {
    case "cover": return <CoverPreview item={item} />;
    case "bridge_pvm": return <BridgePvmPreview item={item} />;
    case "budget_evo": return <BudgetEvoPreview item={item} />;
  }
}
