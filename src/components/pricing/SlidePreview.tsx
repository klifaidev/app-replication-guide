// Slide live preview — mockup visual fiel ao slide PPT exportado.
// Não chama pptxgenjs (seria pesado): renderiza miniaturas em HTML/SVG
// imitando o layout, cores e estrutura do slide real.
import { useMemo } from "react";
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line,
  ResponsiveContainer, XAxis, YAxis,
} from "recharts";
import { applyFilters, calcPVM, type PVMResult } from "@/lib/analytics";
import { computeBudgetEvoMonthly, isItemReady, type SlideItem } from "@/lib/slidesFlow";
import { monthLabel } from "@/lib/format";
import { usePricing } from "@/store/pricing";
import { useBudget } from "@/store/budget";
import { AlertCircle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const HARALD_RED = "#E63946";

const fmtMoneyCompact = (v: number | null | undefined) => {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};
const fmtTons = (v: number | null | undefined) =>
  v == null ? "—" : `${Math.round(v).toLocaleString("pt-BR")} t`;
const signed = (v: number, fmt: (n: number) => string) => `${v >= 0 ? "+" : ""}${fmt(v)}`;

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
      <AlertCircle className="h-5 w-5 text-muted-foreground/60" />
      <p className="text-[11px] text-muted-foreground">{message}</p>
    </div>
  );
}

function Frame({
  children, label, bg = "#FFFFFF",
}: { children: React.ReactNode; label: string; bg?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-border/40 bg-secondary/30 px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Eye className="h-3 w-3" /> Prévia do slide
        </span>
        <span className="text-[9px] text-muted-foreground/60">{label} · 16:9</span>
      </div>
      <div className="relative aspect-[16/9] w-full" style={{ background: bg }}>
        {children}
      </div>
    </div>
  );
}

// Footer "Harald" stub
function HaraldFooter({ light = false }: { light?: boolean }) {
  return (
    <div
      className={cn(
        "absolute bottom-1.5 right-2 text-[6px] font-semibold tracking-[0.2em] uppercase",
        light ? "text-white/70" : "text-muted-foreground/60",
      )}
    >
      Harald
    </div>
  );
}

// ---------------------------------------------------------------------------
// COVER preview — fiel ao addCoverSlide (vermelho cheio ou branco c/ logo)
// ---------------------------------------------------------------------------
function CoverPreview({ item }: { item: Extract<SlideItem, { kind: "cover" }> }) {
  const { title, subtitle, variant } = item.config;
  const isDivider = variant === "divider";
  return (
    <Frame label={isDivider ? "Divisor" : "Capa"} bg={isDivider ? "#FFFFFF" : HARALD_RED}>
      <div className={cn("flex h-full w-full flex-col justify-center px-6", isDivider ? "items-start" : "items-start")}>
        <div className={cn("mb-1 text-[7px] font-semibold uppercase tracking-[0.25em]", isDivider ? "text-muted-foreground" : "text-white/70")}>
          {isDivider ? "Divisor de seção" : "Apresentação"}
        </div>
        <h2
          className={cn(
            "font-semibold leading-tight",
            isDivider ? "text-foreground" : "text-white",
            (title?.length ?? 0) > 40 ? "text-base" : "text-xl",
          )}
        >
          {title || "Título do slide"}
        </h2>
        {subtitle && (
          <p className={cn("mt-1 text-[10px] leading-snug", isDivider ? "text-muted-foreground" : "text-white/85")}>
            {subtitle}
          </p>
        )}
      </div>
      <HaraldFooter light={!isDivider} />
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// BUDGET EVO preview — réplica visual do slide "Overview CM/VOL":
// Título vermelho + 4 linhas (CM Abs, CM%, CM/Kg, Volume).
// ---------------------------------------------------------------------------
function MiniLineRow({
  title, headerNote, data, realKey, budKey, fmt,
}: {
  title: string;
  headerNote?: string;
  data: any[];
  realKey: string;
  budKey: string;
  fmt: (v: number) => string;
}) {
  const gradId = `g_${title.replace(/\W+/g, "")}_${Math.random().toString(36).slice(2, 6)}`;
  return (
    <div className="flex h-full items-stretch gap-2 px-2">
      <div className="flex w-12 shrink-0 flex-col justify-center">
        <div className="text-[7px] font-bold uppercase tracking-wider" style={{ color: HARALD_RED }}>{title}</div>
        {headerNote && <div className="mt-0.5 text-[6px] tabular-nums text-foreground/70">{headerNote}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={HARALD_RED} stopOpacity={0.25} />
                <stop offset="100%" stopColor={HARALD_RED} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 3" vertical={false} stroke="#000" strokeOpacity={0.08} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 6, fill: "#666" }}
              axisLine={false} tickLine={false}
              interval={0}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Area type="monotone" dataKey={realKey} stroke="none" fill={`url(#${gradId})`} connectNulls />
            <Line type="monotone" dataKey={budKey} stroke="#111" strokeWidth={1} strokeDasharray="3 2" dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey={realKey} stroke={HARALD_RED} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MiniVolBars({ data, gapTons }: { data: any[]; gapTons: number }) {
  return (
    <div className="flex h-full items-stretch gap-2 px-2">
      <div className="flex w-12 shrink-0 flex-col justify-center">
        <div className="text-[7px] font-bold uppercase tracking-wider" style={{ color: HARALD_RED }}>Volume</div>
        <div className={cn("mt-0.5 text-[6px] font-semibold tabular-nums", gapTons >= 0 ? "text-success" : "text-destructive")}>
          {signed(gapTons, (v) => fmtTons(v))}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="2 3" vertical={false} stroke="#000" strokeOpacity={0.08} />
            <XAxis dataKey="label" tick={{ fontSize: 6, fill: "#666" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis hide />
            <Bar dataKey="realVol" fill={HARALD_RED} radius={[1.5, 1.5, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="budVol" fill="#222" fillOpacity={0.45} radius={[1.5, 1.5, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BudgetEvoPreview({ item }: { item: Extract<SlideItem, { kind: "budget_evo" }> }) {
  const budgetRows = useBudget((s) => s.rows);
  const data = useMemo(
    () => computeBudgetEvoMonthly(budgetRows, item.config.filters, item.config.start, item.config.end),
    [budgetRows, item.config.filters, item.config.start, item.config.end],
  );

  if (data.length === 0) {
    return <Frame label="Overview CM/VOL"><Empty message="Sem dados Budget para o range escolhido." /></Frame>;
  }

  const accum = data
    .filter((m) => m.realCm !== 0 || m.realVol !== 0)
    .reduce(
      (a, m) => ({ cm: a.cm + (m.realCm - m.budCm), vol: a.vol + (m.realVol - m.budVol) }),
      { cm: 0, vol: 0 },
    );

  return (
    <Frame label="Overview CM/VOL">
      <div className="absolute inset-0 flex flex-col">
        {/* Título */}
        <div className="px-3 pt-2">
          <div className="text-[10px] font-bold leading-none" style={{ color: HARALD_RED }}>
            Overview CM/VOL
          </div>
        </div>
        {/* 4 linhas */}
        <div className="grid flex-1 grid-rows-4 gap-0.5 py-1">
          <MiniLineRow
            title="CM ABS"
            headerNote={signed(accum.cm, (v) => `R$ ${fmtMoneyCompact(v)}`)}
            data={data}
            realKey="realCm" budKey="budCm"
            fmt={(v) => fmtMoneyCompact(v)}
          />
          <MiniLineRow
            title="CM/%"
            data={data}
            realKey="realCmPct" budKey="budCmPct"
            fmt={(v) => `${(v * 100).toFixed(1)}%`}
          />
          <MiniLineRow
            title="CM/Kg"
            data={data}
            realKey="realCmKg" budKey="budCmKg"
            fmt={(v) => v.toFixed(2)}
          />
          <MiniVolBars data={data} gapTons={accum.vol} />
        </div>
        <HaraldFooter />
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// BRIDGE PVM preview — réplica visual da bridge waterfall em SVG.
// ---------------------------------------------------------------------------
function MiniWaterfall({ pvm }: { pvm: PVMResult }) {
  const steps = [
    { label: pvm.baseLabel, delta: pvm.base, total: true, color: "#1F2937" },
    { label: "Vol", delta: pvm.volume, total: false, color: "#3B82F6" },
    { label: "Preço", delta: pvm.price, total: false, color: "#10B981" },
    { label: "Custo", delta: pvm.cost, total: false, color: "#F59E0B" },
    { label: "Frete", delta: pvm.freight, total: false, color: "#8B5CF6" },
    { label: "Comis.", delta: pvm.commission, total: false, color: "#EC4899" },
    { label: "Outros", delta: pvm.others, total: false, color: "#6B7280" },
    { label: pvm.currentLabel, delta: pvm.current, total: true, color: "#1F2937" },
  ];

  let running = 0;
  const cum = steps.map((s) => {
    if (s.total) { running = s.delta; return { start: 0, end: s.delta, value: s.delta }; }
    const start = running, end = running + s.delta;
    running = end;
    return { start, end, value: s.delta };
  });

  const allVals = cum.flatMap((c) => [c.start, c.end, 0]);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = (maxV - minV) || 1;
  const pad = range * 0.15;
  const yMin = minV - pad, yMax = maxV + pad, yRange = yMax - yMin;

  const W = 320, H = 150;
  const padL = 6, padR = 6, padT = 14, padB = 16;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xStep = innerW / steps.length;
  const barW = xStep * 0.6;
  const yOf = (v: number) => padT + (1 - (v - yMin) / yRange) * innerH;
  const zeroY = yOf(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
      <line x1={padL} x2={W - padR} y1={zeroY} y2={zeroY} stroke="#000" strokeOpacity={0.25} />
      {cum.map((c, i) => {
        const s = steps[i];
        const x = padL + i * xStep + (xStep - barW) / 2;
        const top = s.total ? Math.min(zeroY, yOf(c.end)) : yOf(Math.max(c.start, c.end));
        const h = s.total ? Math.abs(yOf(c.end) - zeroY) : Math.abs(yOf(c.end) - yOf(c.start)) || 1.5;
        return (
          <g key={i}>
            <rect x={x} y={top} width={barW} height={h} rx={1.5} fill={s.color} opacity={0.92} />
            <text x={x + barW / 2} y={top - 2} fontSize="5" textAnchor="middle" fill="#111">
              {s.total ? fmtMoneyCompact(c.value) : `${c.value >= 0 ? "+" : ""}${fmtMoneyCompact(c.value)}`}
            </text>
            <text x={x + barW / 2} y={H - padB + 9} fontSize="5.5" textAnchor="middle" fill="#444">
              {s.label.length > 8 ? s.label.slice(0, 8) : s.label}
            </text>
          </g>
        );
      })}
      {/* connectors */}
      {cum.slice(0, -1).map((c, i) => {
        if (steps[i + 1].total) return null;
        const x1 = padL + i * xStep + xStep / 2 + barW / 2;
        const x2 = padL + (i + 1) * xStep + xStep / 2 - barW / 2;
        const y = yOf(c.end);
        return <line key={`c${i}`} x1={x1} x2={x2} y1={y} y2={y} stroke="#666" strokeOpacity={0.4} strokeDasharray="2 2" />;
      })}
    </svg>
  );
}

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
    <Frame label="Bridge PVM">
      <div className="absolute inset-0 flex flex-col p-2">
        <div className="flex items-baseline justify-between px-1">
          <div className="text-[10px] font-bold leading-none" style={{ color: HARALD_RED }}>
            Bridge PVM · {pvm.baseLabel} → {pvm.currentLabel}
          </div>
          <div className="text-[7px] text-muted-foreground">+1 slide tabela · +6 slides por efeito</div>
        </div>
        <div className="mt-1 flex-1 min-h-0">
          <MiniWaterfall pvm={pvm} />
        </div>
        <HaraldFooter />
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
