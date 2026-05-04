import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Columns3,
  Copy,
  Download,
  Eye,
  EyeOff,
  Filter as FilterIcon,
  Flame,
  GripVertical,
  Hash,
  Layers,
  Maximize2,
  Minimize2,
  Plus,
  RotateCcw,
  Rows3,
  Search,
  Sigma,
  Sparkles,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, formatNum, formatPct } from "@/lib/format";
import {
  buildUnifiedRows,
  dimensionsForMode,
  type PivotMode,
  type UnifiedRow,
} from "@/lib/pivotData";
import { computePivot, type PivotMeasure } from "@/lib/pivot";
import type { PricingRow } from "@/lib/types";
import type { BudgetRow } from "@/lib/budget";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

type Zone = "rows" | "cols" | "values" | "filters";
type VizMode = "bars" | "heatmap" | "plain";
type Density = "compact" | "cozy";
type SortState = { col: string; measure: string; dir: "asc" | "desc" } | null;

const DIM_GROUPS = ["Tempo", "Produto", "Inovação", "Comercial"] as const;

// ---------- Catálogo de medidas por modo ----------
function measuresFor(mode: PivotMode): PivotMeasure[] {
  const real: PivotMeasure[] = [
    { id: "rol_real", label: "ROL", field: "rol_real", agg: "sum", format: "currency", tone: "real" },
    { id: "vol_real", label: "Volume", field: "volumeKg_real", agg: "sum", format: "tons", tone: "real" },
    { id: "cm_real", label: "CM", field: "cm_real", agg: "sum", format: "currency", tone: "real" },
    { id: "mb_real", label: "MB", field: "mb_real", agg: "sum", format: "currency", tone: "real" },
    { id: "cogs_real", label: "CPV", field: "cogs_real", agg: "sum", format: "currency", tone: "real" },
    {
      id: "cm_pct_real",
      label: "CM %",
      field: "cm_real",
      agg: "sum",
      format: "percent",
      tone: "real",
      derive: (a) => (a.rol_real > 0 ? a.cm_real / a.rol_real : 0),
    },
  ];
  const budget: PivotMeasure[] = [
    { id: "rol_budget", label: "ROL Bdg", field: "rol_budget", agg: "sum", format: "currency", tone: "budget" },
    { id: "vol_budget", label: "Volume Bdg", field: "volumeKg_budget", agg: "sum", format: "tons", tone: "budget" },
    { id: "cm_budget", label: "CM Bdg", field: "cm_budget", agg: "sum", format: "currency", tone: "budget" },
    { id: "cpv_budget", label: "CPV Bdg", field: "cpv_budget", agg: "sum", format: "currency", tone: "budget" },
    {
      id: "cm_pct_budget",
      label: "CM % Bdg",
      field: "cm_budget",
      agg: "sum",
      format: "percent",
      tone: "budget",
      derive: (a) => (a.rol_budget > 0 ? a.cm_budget / a.rol_budget : 0),
    },
  ];
  const compare: PivotMeasure[] = [
    real[0],
    budget[0],
    {
      id: "delta_rol",
      label: "Δ ROL",
      field: "rol_real",
      agg: "sum",
      format: "currency",
      tone: "delta",
      derive: (a) => a.rol_real - a.rol_budget,
    },
    {
      id: "delta_rol_pct",
      label: "Δ ROL %",
      field: "rol_real",
      agg: "sum",
      format: "percent",
      tone: "delta",
      derive: (a) => (a.rol_budget > 0 ? (a.rol_real - a.rol_budget) / a.rol_budget : 0),
    },
    real[2],
    budget[2],
    {
      id: "delta_cm",
      label: "Δ CM",
      field: "cm_real",
      agg: "sum",
      format: "currency",
      tone: "delta",
      derive: (a) => a.cm_real - a.cm_budget,
    },
    {
      id: "delta_vol",
      label: "Δ Volume",
      field: "volumeKg_real",
      agg: "sum",
      format: "tons",
      tone: "delta",
      derive: (a) => a.volumeKg_real - a.volumeKg_budget,
    },
  ];
  if (mode === "real") return real;
  if (mode === "budget") return budget;
  return compare;
}

function defaultConfig(mode: PivotMode) {
  if (mode === "compare") {
    return {
      rows: ["marca"],
      cols: ["fy"],
      values: ["rol_real", "rol_budget", "delta_rol", "delta_rol_pct"],
    };
  }
  return {
    rows: ["marca"],
    cols: ["fy"],
    values:
      mode === "real"
        ? ["rol_real", "cm_real", "cm_pct_real"]
        : ["rol_budget", "cm_budget", "cm_pct_budget"],
  };
}

// Quick start presets — uma config completa (rows/cols/values) por preset.
type Preset = {
  id: string;
  label: string;
  hint: string;
  modes: PivotMode[];
  build: (mode: PivotMode) => { rows: string[]; cols: string[]; values: string[] };
};
const PRESETS: Preset[] = [
  {
    id: "marca-fy",
    label: "Marca × FY",
    hint: "Visão por marca em cada ano fiscal",
    modes: ["real", "budget", "compare"],
    build: (m) => ({
      rows: ["marca"],
      cols: ["fy"],
      values:
        m === "compare"
          ? ["rol_real", "rol_budget", "delta_rol_pct"]
          : m === "real"
            ? ["rol_real", "cm_real", "cm_pct_real"]
            : ["rol_budget", "cm_budget", "cm_pct_budget"],
    }),
  },
  {
    id: "canal-mes",
    label: "Canal × Mês",
    hint: "Evolução mensal por canal",
    modes: ["real", "budget", "compare"],
    build: (m) => ({
      rows: ["canalAjustado"],
      cols: ["mesLabel"],
      values: m === "real" ? ["rol_real"] : m === "budget" ? ["rol_budget"] : ["delta_rol"],
    }),
  },
  {
    id: "categoria-marca",
    label: "Categoria · Marca",
    hint: "Hierarquia categoria → marca",
    modes: ["real", "budget", "compare"],
    build: (m) => ({
      rows: ["categoria", "marca"],
      cols: ["fy"],
      values: m === "compare" ? ["rol_real", "rol_budget", "delta_rol"] : m === "real" ? ["rol_real", "cm_real"] : ["rol_budget", "cm_budget"],
    }),
  },
  {
    id: "regiao-uf",
    label: "Região × UF",
    hint: "Geografia comercial",
    modes: ["real", "compare"],
    build: () => ({
      rows: ["regiao", "uf"],
      cols: ["fy"],
      values: ["rol_real", "vol_real"],
    }),
  },
  {
    id: "inovacao",
    label: "Inovação vs Regular",
    hint: "Quebra por classificação",
    modes: ["real", "budget", "compare"],
    build: (m) => ({
      rows: ["inovacao"],
      cols: ["mesLabel"],
      values: m === "real" ? ["rol_real", "cm_pct_real"] : m === "budget" ? ["rol_budget", "cm_pct_budget"] : ["rol_real", "rol_budget"],
    }),
  },
];

function fmtValue(measure: PivotMeasure, val: number) {
  if (!isFinite(val) || val === 0) return "—";
  switch (measure.format) {
    case "currency": return formatBRL(val, { compact: true });
    case "percent": return formatPct(val);
    case "tons": return `${formatNum(val / 1000, 1)} t`;
    default: return formatNum(val, 0, true);
  }
}

function fmtKpi(measure: PivotMeasure, val: number) {
  if (!isFinite(val)) return "—";
  if (measure.format === "percent") return formatPct(val);
  if (measure.format === "tons") return `${formatNum(val / 1000, 1)} t`;
  if (measure.format === "currency") {
    const abs = Math.abs(val);
    if (abs >= 1e9) return `${val < 0 ? "-" : ""}R$ ${(abs / 1e9).toFixed(2)} bi`;
    if (abs >= 1e6) return `${val < 0 ? "-" : ""}R$ ${(abs / 1e6).toFixed(1)} mi`;
    if (abs >= 1e3) return `${val < 0 ? "-" : ""}R$ ${(abs / 1e3).toFixed(0)} k`;
    return formatBRL(val);
  }
  return formatNum(val, 0, true);
}

function toneClass(tone?: PivotMeasure["tone"], val?: number) {
  if (tone === "delta") {
    if (val == null || !isFinite(val) || val === 0) return "text-muted-foreground";
    return val > 0 ? "text-emerald-300" : "text-rose-300";
  }
  if (tone === "budget") return "text-accent-foreground/90";
  return "text-foreground";
}

function cellBg(viz: VizMode, m: PivotMeasure, v: number, max: number): React.CSSProperties | undefined {
  if (viz === "plain" || max === 0 || !isFinite(v) || v === 0) return undefined;
  const pct = Math.min(100, (Math.abs(v) / max) * 100);
  if (viz === "heatmap") {
    const isDelta = m.tone === "delta";
    const baseHsl = isDelta
      ? v >= 0
        ? "158 64% 52%"
        : "0 84% 65%"
      : m.tone === "budget"
        ? "263 70% 65%"
        : "217 91% 60%";
    const alpha = 0.06 + (pct / 100) * 0.42;
    return { backgroundColor: `hsl(${baseHsl} / ${alpha})` };
  }
  // bars
  const baseHsl =
    m.tone === "delta"
      ? v >= 0
        ? "158 64% 52%"
        : "0 84% 65%"
      : m.tone === "budget"
        ? "263 70% 65%"
        : "217 91% 60%";
  return {
    backgroundImage: `linear-gradient(to left, hsl(${baseHsl} / 0.55) 0%, hsl(${baseHsl} / 0.55) ${pct}%, transparent ${pct}%)`,
    backgroundSize: "100% 26%",
    backgroundPosition: "right bottom",
    backgroundRepeat: "no-repeat",
  };
}

// ============================================================
//                        COMPONENT
// ============================================================
export function PivotBuilder({
  realRows,
  budgetRows,
}: {
  realRows: PricingRow[];
  budgetRows: BudgetRow[];
}) {
  const [mode, setMode] = useState<PivotMode>("real");
  const [rowsDims, setRowsDims] = useState<string[]>(["marca"]);
  const [colsDims, setColsDims] = useState<string[]>(["fy"]);
  const [valueIds, setValueIds] = useState<string[]>(["rol_real", "cm_real", "cm_pct_real"]);
  const [filterDims, setFilterDims] = useState<string[]>([]);
  const [filterVals, setFilterVals] = useState<Record<string, Set<string>>>({});
  const [paletteQuery, setPaletteQuery] = useState("");

  // UX state
  const [viz, setViz] = useState<VizMode>("bars");
  const [density, setDensity] = useState<Density>("cozy");
  const [hideEmpty, setHideEmpty] = useState(true);
  const [sort, setSort] = useState<SortState>(null);
  const [highlightRow, setHighlightRow] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(true);

  useEffect(() => {
    const def = defaultConfig(mode);
    setRowsDims(def.rows);
    setColsDims(def.cols);
    setValueIds(def.values);
    setFilterDims([]);
    setFilterVals({});
    setSort(null);
  }, [mode]);

  const measureCatalog = useMemo(() => measuresFor(mode), [mode]);
  const measureMap = useMemo(
    () => new Map(measureCatalog.map((m) => [m.id, m])),
    [measureCatalog],
  );
  const dims = useMemo(() => dimensionsForMode(mode), [mode]);
  const dimMap = useMemo(() => new Map(dims.map((d) => [d.id as string, d])), [dims]);

  const unified = useMemo(
    () => buildUnifiedRows(realRows, budgetRows, mode),
    [realRows, budgetRows, mode],
  );

  const selectedMeasures = useMemo(
    () => valueIds.map((id) => measureMap.get(id)).filter(Boolean) as PivotMeasure[],
    [valueIds, measureMap],
  );

  const pivot = useMemo(
    () =>
      computePivot(unified as unknown as Record<string, unknown>[], {
        rows: rowsDims,
        cols: colsDims,
        values: selectedMeasures,
        filters: filterVals,
      }),
    [unified, rowsDims, colsDims, selectedMeasures, filterVals],
  );

  // ----- Drag & Drop (HTML5) -----
  const [dragging, setDragging] = useState<{ id: string; from: Zone | "palette" } | null>(null);
  const [dragOver, setDragOver] = useState<Zone | null>(null);

  function isDimension(id: string) {
    return dimMap.has(id);
  }

  function removeFromZone(id: string, zone: Zone) {
    if (zone === "rows") setRowsDims((p) => p.filter((x) => x !== id));
    else if (zone === "cols") setColsDims((p) => p.filter((x) => x !== id));
    else if (zone === "values") setValueIds((p) => p.filter((x) => x !== id));
    else if (zone === "filters") {
      setFilterDims((p) => p.filter((x) => x !== id));
      setFilterVals((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
    }
  }

  function addToZone(id: string, zone: Zone) {
    if (zone === "values") {
      if (!measureMap.has(id)) return;
      setValueIds((p) => (p.includes(id) ? p : [...p, id]));
      return;
    }
    if (!isDimension(id)) return;
    // remove from other dim zones
    if (zone !== "rows") setRowsDims((p) => p.filter((x) => x !== id));
    if (zone !== "cols") setColsDims((p) => p.filter((x) => x !== id));
    if (zone !== "filters") setFilterDims((p) => p.filter((x) => x !== id));
    if (zone === "rows") setRowsDims((p) => (p.includes(id) ? p : [...p, id]));
    else if (zone === "cols") setColsDims((p) => (p.includes(id) ? p : [...p, id]));
    else if (zone === "filters") setFilterDims((p) => (p.includes(id) ? p : [...p, id]));
  }

  function quickAdd(id: string) {
    // measure → values; dimension → rows by default
    if (measureMap.has(id)) addToZone(id, "values");
    else if (isDimension(id)) addToZone(id, "rows");
  }

  function handleDrop(zone: Zone) {
    if (!dragging) return;
    if (dragging.from !== "palette" && dragging.from !== zone) {
      removeFromZone(dragging.id, dragging.from);
    }
    addToZone(dragging.id, zone);
    setDragging(null);
    setDragOver(null);
  }

  function applyPreset(p: Preset) {
    const cfg = p.build(mode);
    setRowsDims(cfg.rows.filter((d) => dimMap.has(d)));
    setColsDims(cfg.cols.filter((d) => dimMap.has(d)));
    setValueIds(cfg.values.filter((v) => measureMap.has(v)));
    setFilterDims([]);
    setFilterVals({});
    setSort(null);
  }

  function resetAll() {
    const def = defaultConfig(mode);
    setRowsDims(def.rows);
    setColsDims(def.cols);
    setValueIds(def.values);
    setFilterDims([]);
    setFilterVals({});
    setSort(null);
  }

  const usedItems = new Set([...rowsDims, ...colsDims, ...filterDims, ...valueIds]);
  const activeFiltersCount = Object.values(filterVals).reduce((acc, s) => acc + (s?.size ?? 0), 0);

  const matchesQuery = (label: string) =>
    paletteQuery.trim() === "" ||
    label.toLowerCase().includes(paletteQuery.trim().toLowerCase());

  const modeMeta = {
    real: { label: "Real", hint: "Faturamento realizado", chip: "bg-primary text-primary-foreground", glow: "shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)]" },
    budget: { label: "Budget", hint: "Orçado / planejado", chip: "bg-accent text-accent-foreground", glow: "shadow-[0_0_24px_-4px_hsl(var(--accent)/0.6)]" },
    compare: { label: "Comparativo", hint: "Real vs Budget + deltas", chip: "bg-foreground text-background", glow: "shadow-[0_0_24px_-4px_hsl(var(--foreground)/0.4)]" },
  } as const;

  // KPI strip — top measures (até 4)
  const kpiMeasures = selectedMeasures.slice(0, 4);

  return (
    <div className="space-y-4">
      {/* ═════════════════ COMMAND BAR ═════════════════ */}
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card/70 via-card/40 to-card/20 p-4">
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 h-52 w-52 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary", modeMeta[mode].glow)}>
              <Sigma className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight">Pivot Studio</h2>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", modeMeta[mode].chip)}>
                  {modeMeta[mode].label}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {pivot.rowHeaders.length.toLocaleString("pt-BR")} linhas · {selectedMeasures.length} medidas
                {activeFiltersCount > 0 && ` · ${activeFiltersCount} filtros`}
              </p>
            </div>
          </div>

          <div className="flex-1" />

          {/* Mode switcher */}
          <div className="inline-flex rounded-xl border border-border/50 bg-secondary/40 p-1">
            {(["real", "budget", "compare"] as PivotMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
                  mode === m
                    ? m === "real"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : m === "budget"
                        ? "bg-accent text-accent-foreground shadow-sm"
                        : "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "real" ? "Real" : m === "budget" ? "Budget" : "Comparativo"}
              </button>
            ))}
          </div>

          {/* Viz mode */}
          <div className="inline-flex rounded-xl border border-border/50 bg-secondary/40 p-1">
            {([
              { id: "bars" as const, icon: BarChart3, label: "Barras" },
              { id: "heatmap" as const, icon: Flame, label: "Heatmap" },
              { id: "plain" as const, icon: Hash, label: "Limpo" },
            ]).map((v) => (
              <button
                key={v.id}
                onClick={() => setViz(v.id)}
                title={v.label}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all",
                  viz === v.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <v.icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {/* Density */}
          <button
            onClick={() => setDensity((d) => (d === "compact" ? "cozy" : "compact"))}
            title={density === "compact" ? "Aumentar" : "Compactar"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-secondary/40 text-muted-foreground hover:text-foreground"
          >
            {density === "compact" ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
          </button>

          {/* Hide empty */}
          <button
            onClick={() => setHideEmpty((h) => !h)}
            title={hideEmpty ? "Mostrar linhas vazias" : "Ocultar linhas vazias"}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 text-muted-foreground hover:text-foreground",
              hideEmpty ? "bg-primary/10 text-primary" : "bg-secondary/40",
            )}
          >
            {hideEmpty ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>

          {/* Export */}
          <ExportMenu
            pivot={pivot}
            measures={selectedMeasures}
            rowDims={rowsDims}
            colDims={colsDims}
            dimMap={dimMap}
          />

          <Button
            size="sm"
            variant="ghost"
            onClick={resetAll}
            className="h-8 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
        </div>

        {/* Presets row */}
        <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            <Wand2 className="h-3 w-3" /> Presets
          </div>
          {PRESETS.filter((p) => p.modes.includes(mode)).map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              title={p.hint}
              className="group inline-flex items-center gap-1 rounded-full border border-border/50 bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
            >
              <Zap className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═════════════════ KPI STRIP ═════════════════ */}
      {kpiMeasures.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpiMeasures.map((m, i) => {
            const v = pivot.grandTotal[m.id] ?? 0;
            const tone =
              m.tone === "delta"
                ? v >= 0
                  ? "from-emerald-500/15 to-emerald-500/0 border-emerald-500/25"
                  : "from-rose-500/15 to-rose-500/0 border-rose-500/25"
                : m.tone === "budget"
                  ? "from-accent/15 to-accent/0 border-accent/25"
                  : "from-primary/15 to-primary/0 border-primary/25";
            return (
              <div
                key={m.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3.5 transition-all hover:-translate-y-px hover:shadow-lg",
                  tone,
                )}
                style={{ animation: `fade-up 0.4s ${i * 60}ms both` }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </div>
                <div className={cn("mt-1 text-2xl font-semibold tabular-nums", toneClass(m.tone, v))}>
                  {fmtKpi(m, v)}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground/70">
                  {pivot.rowHeaders.length} linhas · {pivot.colHeaders.length || 1} colunas
                </div>
                <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-foreground/5 blur-2xl transition-opacity group-hover:bg-foreground/10" />
              </div>
            );
          })}
        </div>
      )}

      {/* ═════════════════ MAIN GRID ═════════════════ */}
      <div className={cn("grid grid-cols-1 gap-4", paletteOpen ? "lg:grid-cols-[260px_1fr]" : "lg:grid-cols-[44px_1fr]")}>
        {/* PALETTE */}
        <aside className="relative space-y-3 rounded-2xl border border-border/40 bg-card/30 p-3">
          <button
            onClick={() => setPaletteOpen((o) => !o)}
            className="absolute -right-3 top-3 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground hover:text-foreground"
            title={paletteOpen ? "Fechar paleta" : "Abrir paleta"}
          >
            {paletteOpen ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>

          {!paletteOpen && (
            <div className="flex flex-col items-center gap-2 py-2 text-muted-foreground">
              <Layers className="h-4 w-4" />
            </div>
          )}

          {paletteOpen && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Layers className="h-3.5 w-3.5" /> Campos
                </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={paletteQuery}
                    onChange={(e) => setPaletteQuery(e.target.value)}
                    placeholder="Buscar…"
                    className="h-8 border-border/40 bg-secondary/40 pl-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                  <Sparkles className="h-3 w-3" />
                  Clique para adicionar · arraste p/ outra zona
                </div>
              </div>

              {DIM_GROUPS.map((g) => {
                const items = dims.filter((d) => d.group === g && matchesQuery(d.label));
                if (items.length === 0) return null;
                return (
                  <div key={g} className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {g}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {items.map((d) => (
                        <Chip
                          key={d.id as string}
                          label={d.label}
                          faded={usedItems.has(d.id as string)}
                          draggable
                          onClick={() => quickAdd(d.id as string)}
                          onDragStart={() => setDragging({ id: d.id as string, from: "palette" })}
                          onDragEnd={() => setDragging(null)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="space-y-1.5 border-t border-border/30 pt-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Medidas
                </div>
                <div className="flex flex-wrap gap-1">
                  {measureCatalog.filter((m) => matchesQuery(m.label)).map((m) => (
                    <Chip
                      key={m.id}
                      label={m.label}
                      tone={m.tone}
                      faded={usedItems.has(m.id)}
                      draggable
                      onClick={() => quickAdd(m.id)}
                      onDragStart={() => setDragging({ id: m.id, from: "palette" })}
                      onDragEnd={() => setDragging(null)}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>

        {/* CONFIG ZONES + TABLE */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <DropZone
              label="Filtros"
              icon={<FilterIcon className="h-3.5 w-3.5" />}
              accent="muted"
              zone="filters"
              count={filterDims.length}
              dragOver={dragOver === "filters"}
              setDragOver={setDragOver}
              onDrop={() => handleDrop("filters")}
            >
              {filterDims.length === 0 && <Hint>Arraste uma dimensão</Hint>}
              {filterDims.map((id) => (
                <FilterChip
                  key={id}
                  label={dimMap.get(id)?.label ?? id}
                  values={[...new Set(unified.map((u) => String((u as unknown as Record<string, unknown>)[id] ?? "—")))]
                    .filter(Boolean)
                    .sort()}
                  selected={filterVals[id] ?? new Set()}
                  onChange={(s) => setFilterVals((prev) => ({ ...prev, [id]: s }))}
                  onRemove={() => removeFromZone(id, "filters")}
                  draggable
                  onDragStart={() => setDragging({ id, from: "filters" })}
                  onDragEnd={() => setDragging(null)}
                />
              ))}
            </DropZone>

            <DropZone
              label="Colunas"
              icon={<Columns3 className="h-3.5 w-3.5" />}
              accent="primary"
              zone="cols"
              count={colsDims.length}
              dragOver={dragOver === "cols"}
              setDragOver={setDragOver}
              onDrop={() => handleDrop("cols")}
            >
              {colsDims.length === 0 && <Hint>Sem colunas (total)</Hint>}
              {colsDims.map((id) => (
                <Chip
                  key={id}
                  label={dimMap.get(id)?.label ?? id}
                  closable
                  onRemove={() => removeFromZone(id, "cols")}
                  draggable
                  onDragStart={() => setDragging({ id, from: "cols" })}
                  onDragEnd={() => setDragging(null)}
                />
              ))}
            </DropZone>

            <DropZone
              label="Linhas"
              icon={<Rows3 className="h-3.5 w-3.5" />}
              accent="primary"
              zone="rows"
              count={rowsDims.length}
              dragOver={dragOver === "rows"}
              setDragOver={setDragOver}
              onDrop={() => handleDrop("rows")}
            >
              {rowsDims.length === 0 && <Hint>Sem linhas (total)</Hint>}
              {rowsDims.map((id) => (
                <Chip
                  key={id}
                  label={dimMap.get(id)?.label ?? id}
                  closable
                  onRemove={() => removeFromZone(id, "rows")}
                  draggable
                  onDragStart={() => setDragging({ id, from: "rows" })}
                  onDragEnd={() => setDragging(null)}
                />
              ))}
            </DropZone>

            <DropZone
              label="Valores"
              icon={<Sigma className="h-3.5 w-3.5" />}
              accent="accent"
              zone="values"
              count={valueIds.length}
              dragOver={dragOver === "values"}
              setDragOver={setDragOver}
              onDrop={() => handleDrop("values")}
            >
              {valueIds.length === 0 && <Hint>Arraste medidas</Hint>}
              {valueIds.map((id) => {
                const m = measureMap.get(id);
                return (
                  <Chip
                    key={id}
                    label={m?.label ?? id}
                    tone={m?.tone}
                    closable
                    onRemove={() => removeFromZone(id, "values")}
                    draggable
                    onDragStart={() => setDragging({ id, from: "values" })}
                    onDragEnd={() => setDragging(null)}
                  />
                );
              })}
            </DropZone>
          </div>

          <PivotTable
            pivot={pivot}
            measures={selectedMeasures}
            rowDims={rowsDims}
            colDims={colsDims}
            dimMap={dimMap}
            viz={viz}
            density={density}
            hideEmpty={hideEmpty}
            sort={sort}
            setSort={setSort}
            highlightRow={highlightRow}
            setHighlightRow={setHighlightRow}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
//                       SUB-COMPONENTS
// ============================================================
function Hint({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] italic text-muted-foreground/60">{children}</span>;
}

function Chip({
  label,
  tone,
  closable,
  faded,
  onRemove,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  label: string;
  tone?: PivotMeasure["tone"];
  closable?: boolean;
  faded?: boolean;
  onRemove?: () => void;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const toneRing =
    tone === "budget"
      ? "border-accent/40 bg-accent/10 text-accent-foreground hover:bg-accent/20"
      : tone === "delta"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
        : tone === "real"
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
          : "border-border/60 bg-secondary/60 text-foreground hover:bg-secondary";

  return (
    <span
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "group inline-flex cursor-grab select-none items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium shadow-sm transition-all hover:-translate-y-px hover:shadow active:cursor-grabbing",
        toneRing,
        faded && "opacity-50",
      )}
    >
      <GripVertical className="h-3 w-3 opacity-40 transition-opacity group-hover:opacity-80" />
      {label}
      {closable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="ml-0.5 rounded-full p-0.5 opacity-60 hover:bg-foreground/10 hover:opacity-100"
          aria-label="Remover"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

function FilterChip({
  label,
  values,
  selected,
  onChange,
  onRemove,
  draggable,
  onDragStart,
  onDragEnd,
}: {
  label: string;
  values: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  onRemove: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [q, setQ] = useState("");
  const count = selected.size;
  const filtered = values.filter((v) => v.toLowerCase().includes(q.toLowerCase()));
  return (
    <span
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className="inline-flex items-center"
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "inline-flex cursor-grab items-center gap-1 rounded-l-full border border-r-0 px-2 py-0.5 text-[11px] font-medium transition-all hover:-translate-y-px active:cursor-grabbing",
              count > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-secondary/60 text-foreground",
            )}
          >
            <GripVertical className="h-3 w-3 opacity-40" />
            {label}
            {count > 0 && (
              <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px]">{count}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2 text-[11px] font-semibold">
            <span>{label}</span>
            <span className="text-muted-foreground font-normal">{values.length} valores</span>
          </div>
          <div className="border-b border-border/30 p-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar valor…" className="h-7 text-xs" />
          </div>
          <div className="max-h-64 overflow-auto p-1">
            {filtered.map((v) => {
              const checked = selected.has(v);
              return (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-secondary/60"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(c) => {
                      const next = new Set(selected);
                      if (c) next.add(v); else next.delete(v);
                      onChange(next);
                    }}
                  />
                  <span className="truncate">{v}</span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">Nenhum valor</div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border/40 p-2">
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onChange(new Set())}>
              Limpar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onChange(new Set(values))}>
              Todos
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <button
        onClick={onRemove}
        className="rounded-r-full border border-l-0 border-border/60 bg-secondary/60 px-1.5 py-0.5 hover:bg-secondary"
        aria-label="Remover filtro"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function DropZone({
  label,
  icon,
  zone,
  count,
  accent,
  dragOver,
  setDragOver,
  onDrop,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  zone: Zone;
  count: number;
  accent: "primary" | "accent" | "muted";
  dragOver: boolean;
  setDragOver: (z: Zone | null) => void;
  onDrop: () => void;
  children: React.ReactNode;
}) {
  const accentRing =
    accent === "primary"
      ? "before:bg-primary/70"
      : accent === "accent"
        ? "before:bg-accent/70"
        : "before:bg-muted-foreground/40";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(zone);
      }}
      onDragLeave={() => setDragOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
      className={cn(
        "relative min-h-[78px] overflow-hidden rounded-xl border bg-card/30 p-2.5 transition-all",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-xl",
        accentRing,
        dragOver
          ? "scale-[1.01] border-primary/60 bg-primary/5 shadow-lg shadow-primary/10"
          : "border-border/40",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {icon}
          {label}
        </div>
        {count > 0 && (
          <span className="rounded-full bg-secondary/80 px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
            {count}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

// ============================================================
//                         TABLE
// ============================================================
interface DimMeta { id: string; label: string; group: string }

function PivotTable({
  pivot,
  measures,
  rowDims,
  colDims,
  dimMap,
  viz,
  density,
  hideEmpty,
  sort,
  setSort,
  highlightRow,
  setHighlightRow,
}: {
  pivot: ReturnType<typeof computePivot>;
  measures: PivotMeasure[];
  rowDims: string[];
  colDims: string[];
  dimMap: Map<string, DimMeta>;
  viz: VizMode;
  density: Density;
  hideEmpty: boolean;
  sort: SortState;
  setSort: (s: SortState) => void;
  highlightRow: string | null;
  setHighlightRow: (k: string | null) => void;
}) {
  if (measures.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 bg-card/20 text-sm">
        <Sigma className="h-10 w-10 text-muted-foreground/40" />
        <div className="text-muted-foreground">
          Adicione ao menos uma medida em <span className="font-semibold text-foreground">Valores</span>
        </div>
        <div className="text-[11px] text-muted-foreground/60">
          Clique em uma medida da paleta ou use um preset acima
        </div>
      </div>
    );
  }

  const hasCols = colDims.length > 0 && pivot.colHeaders.length > 0;
  const cols = hasCols ? pivot.colHeaders : [{ key: "__all__", values: [], depth: 0, isLeaf: true }];

  // Sort row headers
  const sortedRows = useMemo(() => {
    let rows = pivot.rowHeaders;
    if (hideEmpty) {
      rows = rows.filter((rh) => {
        const tot = pivot.rowTotals.get(rh.key);
        if (!tot) return false;
        return measures.some((m) => Math.abs(tot[m.id] ?? 0) > 0);
      });
    }
    if (sort) {
      const getter = (k: string) => {
        if (sort.col === "__total__") return pivot.rowTotals.get(k)?.[sort.measure] ?? 0;
        return pivot.cells.get(k)?.get(sort.col)?.[sort.measure] ?? 0;
      };
      rows = [...rows].sort((a, b) => {
        const va = getter(a.key);
        const vb = getter(b.key);
        return sort.dir === "asc" ? va - vb : vb - va;
      });
    }
    return rows;
  }, [pivot, measures, sort, hideEmpty]);

  // max abs por medida (escopo: visível)
  const maxByMeasure = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of measures) {
      let max = 0;
      for (const rh of sortedRows) {
        for (const c of cols) {
          const v = pivot.cells.get(rh.key)?.get(c.key)?.[m.id] ?? 0;
          if (isFinite(v)) max = Math.max(max, Math.abs(v));
        }
      }
      map.set(m.id, max);
    }
    return map;
  }, [measures, sortedRows, cols, pivot]);

  function toggleSort(colKey: string, measureId: string) {
    if (sort && sort.col === colKey && sort.measure === measureId) {
      if (sort.dir === "desc") setSort({ col: colKey, measure: measureId, dir: "asc" });
      else setSort(null);
    } else {
      setSort({ col: colKey, measure: measureId, dir: "desc" });
    }
  }

  const cellPad = density === "compact" ? "py-1 px-2" : "py-2 px-3";
  const headerPad = density === "compact" ? "py-1.5 px-2" : "py-2.5 px-3";

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/30 shadow-sm">
      <div className="relative max-h-[68vh] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-20">
            {hasCols && (
              <tr>
                {rowDims.map((d, i) => (
                  <th
                    key={`rh-${d}`}
                    className={cn(
                      "border-b border-border/40 bg-card/95 backdrop-blur text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                      headerPad,
                      i === 0 && "sticky left-0 z-10",
                    )}
                  >
                    {dimMap.get(d)?.label ?? d}
                  </th>
                ))}
                {rowDims.length === 0 && (
                  <th className={cn("sticky left-0 z-10 border-b border-border/40 bg-card/95 backdrop-blur", headerPad)} />
                )}
                {cols.map((c) => (
                  <th
                    key={`ch-${c.key}`}
                    colSpan={measures.length}
                    className={cn(
                      "border-b border-l border-border/40 bg-card/95 backdrop-blur text-center text-[11px] font-semibold",
                      headerPad,
                    )}
                  >
                    {c.values.join(" · ") || "Total"}
                  </th>
                ))}
                <th
                  colSpan={measures.length}
                  className={cn(
                    "border-b border-l-2 border-primary/40 bg-primary/15 backdrop-blur text-center text-[11px] font-semibold text-primary",
                    headerPad,
                  )}
                >
                  Total
                </th>
              </tr>
            )}
            <tr>
              {rowDims.map((d, idx) => (
                <th
                  key={`rh2-${d}`}
                  className={cn(
                    "border-b border-border/40 bg-card/95 backdrop-blur text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground",
                    headerPad,
                    idx === 0 && "sticky left-0 z-10",
                  )}
                >
                  {!hasCols && (dimMap.get(d)?.label ?? d)}
                </th>
              ))}
              {rowDims.length === 0 && !hasCols && (
                <th className={cn("sticky left-0 z-10 border-b border-border/40 bg-card/95 backdrop-blur", headerPad)} />
              )}
              {cols.map((c) =>
                measures.map((m) => {
                  const isSorted = sort && sort.col === c.key && sort.measure === m.id;
                  return (
                    <th
                      key={`mh-${c.key}-${m.id}`}
                      onClick={() => toggleSort(c.key, m.id)}
                      className={cn(
                        "cursor-pointer select-none border-b border-l border-border/40 bg-card/95 backdrop-blur text-right text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-secondary/80",
                        headerPad,
                        toneClass(m.tone),
                        isSorted && "text-primary",
                      )}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        {m.label}
                        {isSorted ? (
                          sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-20" />
                        )}
                      </span>
                    </th>
                  );
                }),
              )}
              {hasCols &&
                measures.map((m) => {
                  const isSorted = sort && sort.col === "__total__" && sort.measure === m.id;
                  return (
                    <th
                      key={`th-total-${m.id}`}
                      onClick={() => toggleSort("__total__", m.id)}
                      className={cn(
                        "cursor-pointer select-none border-b border-l border-border/40 bg-primary/10 backdrop-blur text-right text-[10px] font-semibold uppercase tracking-wider transition-colors hover:bg-primary/20",
                        headerPad,
                        toneClass(m.tone),
                        isSorted && "text-primary",
                      )}
                    >
                      <span className="inline-flex items-center justify-end gap-1">
                        {m.label}
                        {isSorted ? (
                          sort!.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-20" />
                        )}
                      </span>
                    </th>
                  );
                })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td
                  colSpan={Math.max(1, rowDims.length) + cols.length * measures.length + (hasCols ? measures.length : 0)}
                  className="px-3 py-12 text-center text-sm text-muted-foreground"
                >
                  Sem dados para exibir. Ajuste filtros ou desative "ocultar linhas vazias".
                </td>
              </tr>
            )}
            {sortedRows.map((rh, i) => {
              const isHL = highlightRow === rh.key;
              return (
                <tr
                  key={rh.key}
                  onMouseEnter={() => setHighlightRow(rh.key)}
                  onMouseLeave={() => setHighlightRow(null)}
                  className={cn(
                    "group border-b border-border/15 transition-colors",
                    i % 2 === 0 && "bg-background/30",
                    isHL && "bg-primary/[0.06]",
                  )}
                  style={{ animation: `fade-in 0.25s ${Math.min(i, 30) * 12}ms both` }}
                >
                  {rowDims.map((_, idx) => (
                    <td
                      key={`rv-${rh.key}-${idx}`}
                      className={cn(
                        "text-foreground",
                        cellPad,
                        idx === 0 && "sticky left-0 z-[1] bg-card/85 backdrop-blur font-medium group-hover:bg-card",
                      )}
                    >
                      {rh.values[idx] ?? ""}
                    </td>
                  ))}
                  {rowDims.length === 0 && (
                    <td className={cn("sticky left-0 z-[1] bg-card/85 backdrop-blur font-semibold text-muted-foreground", cellPad)}>Total</td>
                  )}
                  {cols.map((c) => {
                    const cell = pivot.cells.get(rh.key)?.get(c.key) ?? {};
                    return measures.map((m) => {
                      const v = cell[m.id] ?? 0;
                      const max = maxByMeasure.get(m.id) ?? 0;
                      return (
                        <td
                          key={`v-${rh.key}-${c.key}-${m.id}`}
                          style={cellBg(viz, m, v, max)}
                          className={cn(
                            "border-l border-border/10 text-right tabular-nums transition-colors",
                            cellPad,
                            toneClass(m.tone, v),
                          )}
                        >
                          {fmtValue(m, v)}
                        </td>
                      );
                    });
                  })}
                  {hasCols &&
                    measures.map((m) => {
                      const v = pivot.rowTotals.get(rh.key)?.[m.id] ?? 0;
                      return (
                        <td
                          key={`rt-${rh.key}-${m.id}`}
                          className={cn(
                            "border-l border-primary/20 bg-primary/5 text-right font-semibold tabular-nums",
                            cellPad,
                            toneClass(m.tone, v),
                          )}
                        >
                          {fmtValue(m, v)}
                        </td>
                      );
                    })}
                </tr>
              );
            })}

            {/* Footer total */}
            <tr className="sticky bottom-0 z-10 border-t-2 border-primary/40 bg-gradient-to-r from-primary/15 via-primary/8 to-primary/15 font-semibold backdrop-blur">
              {rowDims.map((_, idx) => (
                <td key={`ft-${idx}`} className={cn("text-foreground", cellPad, idx === 0 && "sticky left-0 z-[1]")}>
                  {idx === 0 ? "Total geral" : ""}
                </td>
              ))}
              {rowDims.length === 0 && <td className={cn("sticky left-0 z-[1]", cellPad)}>Total</td>}
              {cols.map((c) =>
                measures.map((m) => {
                  const v = pivot.colTotals.get(c.key)?.[m.id] ?? 0;
                  return (
                    <td
                      key={`ct-${c.key}-${m.id}`}
                      className={cn("border-l border-border/40 text-right tabular-nums", cellPad, toneClass(m.tone, v))}
                    >
                      {fmtValue(m, v)}
                    </td>
                  );
                }),
              )}
              {hasCols &&
                measures.map((m) => {
                  const v = pivot.grandTotal[m.id] ?? 0;
                  return (
                    <td
                      key={`gt-${m.id}`}
                      className={cn(
                        "border-l border-primary/30 bg-primary/15 text-right tabular-nums",
                        cellPad,
                        toneClass(m.tone, v),
                      )}
                    >
                      {fmtValue(m, v)}
                    </td>
                  );
                })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
//                       EXPORT MENU
// ============================================================
function ExportMenu({
  pivot,
  measures,
  rowDims,
  colDims,
  dimMap,
}: {
  pivot: ReturnType<typeof computePivot>;
  measures: PivotMeasure[];
  rowDims: string[];
  colDims: string[];
  dimMap: Map<string, DimMeta>;
}) {
  const buildCsv = () => {
    const sep = ";";
    const cols = colDims.length > 0 && pivot.colHeaders.length > 0
      ? pivot.colHeaders
      : [{ key: "__all__", values: [], depth: 0, isLeaf: true }];
    const head1 = [
      ...rowDims.map((d) => dimMap.get(d)?.label ?? d),
      ...cols.flatMap((c) => measures.map((m) => `${c.values.join(" · ") || "Total"} | ${m.label}`)),
      ...measures.map((m) => `Total | ${m.label}`),
    ];
    const lines = [head1.join(sep)];
    for (const rh of pivot.rowHeaders) {
      const row: string[] = [];
      rowDims.forEach((_, i) => row.push(rh.values[i] ?? ""));
      for (const c of cols) {
        const cell = pivot.cells.get(rh.key)?.get(c.key) ?? {};
        for (const m of measures) {
          const v = cell[m.id] ?? 0;
          row.push(isFinite(v) ? String(v).replace(".", ",") : "");
        }
      }
      for (const m of measures) {
        const v = pivot.rowTotals.get(rh.key)?.[m.id] ?? 0;
        row.push(isFinite(v) ? String(v).replace(".", ",") : "");
      }
      lines.push(row.join(sep));
    }
    return lines.join("\n");
  };

  const download = () => {
    const csv = buildCsv();
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pivot_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildCsv().replace(/;/g, "\t"));
    } catch {/* noop */}
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Exportar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-secondary/40 text-muted-foreground hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="end">
        <button
          onClick={download}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-secondary/60"
        >
          <Download className="h-3.5 w-3.5" /> Baixar CSV
        </button>
        <button
          onClick={copy}
          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-secondary/60"
        >
          <Copy className="h-3.5 w-3.5" /> Copiar (TSV)
        </button>
      </PopoverContent>
    </Popover>
  );
}
