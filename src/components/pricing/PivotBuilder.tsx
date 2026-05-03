import { useEffect, useMemo, useState } from "react";
import {
  Columns3,
  Filter as FilterIcon,
  GripVertical,
  Layers,
  Rows3,
  Search,
  Sigma,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRL, formatNum, formatPct } from "@/lib/format";
import {
  ALL_DIMENSIONS,
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

const DIM_GROUPS = ["Tempo", "Produto", "Inovação", "Comercial"];

// ---------- Catálogo de medidas por modo ----------
function measuresFor(mode: PivotMode): PivotMeasure[] {
  const real: PivotMeasure[] = [
    { id: "rol_real", label: "ROL (Real)", field: "rol_real", agg: "sum", format: "currency", tone: "real" },
    { id: "vol_real", label: "Volume kg (Real)", field: "volumeKg_real", agg: "sum", format: "tons", tone: "real" },
    { id: "cm_real", label: "CM (Real)", field: "cm_real", agg: "sum", format: "currency", tone: "real" },
    { id: "mb_real", label: "MB (Real)", field: "mb_real", agg: "sum", format: "currency", tone: "real" },
    { id: "cogs_real", label: "CPV (Real)", field: "cogs_real", agg: "sum", format: "currency", tone: "real" },
    {
      id: "cm_pct_real",
      label: "CM % (Real)",
      field: "cm_real",
      agg: "sum",
      format: "percent",
      tone: "real",
      derive: (a) => (a.rol_real > 0 ? a.cm_real / a.rol_real : 0),
    },
  ];
  const budget: PivotMeasure[] = [
    { id: "rol_budget", label: "ROL (Budget)", field: "rol_budget", agg: "sum", format: "currency", tone: "budget" },
    { id: "vol_budget", label: "Volume kg (Budget)", field: "volumeKg_budget", agg: "sum", format: "tons", tone: "budget" },
    { id: "cm_budget", label: "CM (Budget)", field: "cm_budget", agg: "sum", format: "currency", tone: "budget" },
    { id: "cpv_budget", label: "CPV (Budget)", field: "cpv_budget", agg: "sum", format: "currency", tone: "budget" },
    {
      id: "cm_pct_budget",
      label: "CM % (Budget)",
      field: "cm_budget",
      agg: "sum",
      format: "percent",
      tone: "budget",
      derive: (a) => (a.rol_budget > 0 ? a.cm_budget / a.rol_budget : 0),
    },
  ];
  const compare: PivotMeasure[] = [
    ...real.slice(0, 3),
    ...budget.slice(0, 3),
    {
      id: "delta_rol",
      label: "Δ ROL (Real − Budget)",
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
    {
      id: "delta_cm",
      label: "Δ CM (Real − Budget)",
      field: "cm_real",
      agg: "sum",
      format: "currency",
      tone: "delta",
      derive: (a) => a.cm_real - a.cm_budget,
    },
    {
      id: "delta_vol",
      label: "Δ Volume kg",
      field: "volumeKg_real",
      agg: "sum",
      format: "number",
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
      filters: {} as Record<string, string[]>,
    };
  }
  return {
    rows: ["marca"],
    cols: ["fy"],
    values: mode === "real" ? ["rol_real", "cm_real", "cm_pct_real"] : ["rol_budget", "cm_budget", "cm_pct_budget"],
    filters: {} as Record<string, string[]>,
  };
}

function fmtValue(measure: PivotMeasure, val: number) {
  if (!isFinite(val) || val === 0) return "—";
  switch (measure.format) {
    case "currency": return formatBRL(val, { compact: true });
    case "percent": return formatPct(val);
    case "tons": return `${formatNum(val, 0)} t`;
    default: return formatNum(val, 0, true);
  }
}

function toneClass(tone?: PivotMeasure["tone"], val?: number) {
  if (tone === "budget") return "text-accent";
  if (tone === "delta") {
    if (val == null || !isFinite(val)) return "text-muted-foreground";
    if (val > 0) return "text-emerald-400";
    if (val < 0) return "text-rose-400";
    return "text-muted-foreground";
  }
  if (tone === "real") return "text-foreground";
  return "text-foreground";
}

function toneAccentBar(tone?: PivotMeasure["tone"], val?: number) {
  if (tone === "delta") {
    if (val == null || !isFinite(val) || val === 0) return "hsl(var(--muted-foreground) / 0.35)";
    return val > 0 ? "hsl(158 64% 52% / 0.6)" : "hsl(0 84% 65% / 0.6)";
  }
  if (tone === "budget") return "hsl(var(--accent) / 0.55)";
  return "hsl(var(--primary) / 0.55)";
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

  useEffect(() => {
    const def = defaultConfig(mode);
    setRowsDims(def.rows);
    setColsDims(def.cols);
    setValueIds(def.values);
    setFilterDims([]);
    setFilterVals({});
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

  // ----- Drag & Drop -----
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
    if (zone === "rows") setRowsDims((p) => (p.includes(id) ? p : [...p, id]));
    else if (zone === "cols") setColsDims((p) => (p.includes(id) ? p : [...p, id]));
    else if (zone === "filters") setFilterDims((p) => (p.includes(id) ? p : [...p, id]));
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

  function resetAll() {
    const def = defaultConfig(mode);
    setRowsDims(def.rows);
    setColsDims(def.cols);
    setValueIds(def.values);
    setFilterDims([]);
    setFilterVals({});
  }

  const usedItems = new Set([...rowsDims, ...colsDims, ...filterDims, ...valueIds]);
  const activeFiltersCount = Object.values(filterVals).reduce(
    (acc, s) => acc + (s?.size ?? 0),
    0,
  );

  const matchesQuery = (label: string) =>
    paletteQuery.trim() === "" ||
    label.toLowerCase().includes(paletteQuery.trim().toLowerCase());

  const modeMeta = {
    real: { label: "Real", hint: "Faturamento realizado", chip: "bg-primary text-primary-foreground" },
    budget: { label: "Budget", hint: "Orçado / planejado", chip: "bg-accent text-accent-foreground" },
    compare: { label: "Comparativo", hint: "Real vs Budget + deltas", chip: "bg-foreground text-background" },
  } as const;

  return (
    <div className="space-y-5">
      {/* HERO HEADER */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card/60 via-card/30 to-transparent p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sigma className="h-4 w-4" />
              </span>
              <h2 className="text-base font-semibold tracking-tight">Construtor dinâmico</h2>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", modeMeta[mode].chip)}>
                {modeMeta[mode].label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {modeMeta[mode].hint} · {pivot.rowHeaders.length.toLocaleString("pt-BR")} linhas · {selectedMeasures.length} medidas
              {activeFiltersCount > 0 && ` · ${activeFiltersCount} filtros ativos`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-xl border border-border/50 bg-secondary/40 p-1">
              {(["real", "budget", "compare"] as PivotMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
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
            <Button
              size="sm"
              variant="ghost"
              onClick={resetAll}
              className="h-8 text-[11px] text-muted-foreground hover:text-foreground"
            >
              Restaurar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* PALETTE */}
        <aside className="space-y-4 rounded-2xl border border-border/40 bg-card/30 p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="h-3.5 w-3.5" /> Campos disponíveis
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Buscar campo…"
                className="h-8 border-border/40 bg-secondary/40 pl-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
              <Sparkles className="h-3 w-3" />
              Arraste para as zonas abaixo
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
                <div className="flex flex-wrap gap-1.5">
                  {items.map((d) => (
                    <Chip
                      key={d.id as string}
                      label={d.label}
                      faded={usedItems.has(d.id as string)}
                      draggable
                      onDragStart={() => setDragging({ id: d.id as string, from: "palette" })}
                      onDragEnd={() => setDragging(null)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          <div className="space-y-1.5 border-t border-border/30 pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Medidas
            </div>
            <div className="flex flex-wrap gap-1.5">
              {measureCatalog.filter((m) => matchesQuery(m.label)).map((m) => (
                <Chip
                  key={m.id}
                  label={m.label}
                  tone={m.tone}
                  faded={usedItems.has(m.id)}
                  draggable
                  onDragStart={() => setDragging({ id: m.id, from: "palette" })}
                  onDragEnd={() => setDragging(null)}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* CONFIG ZONES + TABLE */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
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
  draggable,
  onDragStart,
  onDragEnd,
}: {
  label: string;
  tone?: PivotMeasure["tone"];
  closable?: boolean;
  faded?: boolean;
  onRemove?: () => void;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const toneRing =
    tone === "budget"
      ? "border-accent/40 bg-accent/10 text-accent"
      : tone === "delta"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
        : tone === "real"
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-secondary/60 text-foreground";

  return (
    <span
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group inline-flex cursor-grab select-none items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium shadow-sm transition-all hover:-translate-y-px hover:shadow active:cursor-grabbing",
        toneRing,
        faded && "opacity-50",
      )}
    >
      <GripVertical className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-90" />
      {label}
      {closable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="ml-0.5 rounded-full p-0.5 opacity-70 hover:bg-foreground/10 hover:opacity-100"
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
  const count = selected.size;
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
              "inline-flex cursor-grab items-center gap-1 rounded-l-full border border-r-0 px-2 py-1 text-[11px] font-medium transition-all hover:-translate-y-px active:cursor-grabbing",
              count > 0
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 bg-secondary/60 text-foreground",
            )}
          >
            <GripVertical className="h-3 w-3 opacity-50" />
            {label}
            {count > 0 && (
              <span className="ml-1 rounded-full bg-primary/20 px-1.5 text-[10px]">{count}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="border-b border-border/40 px-3 py-2 text-[11px] font-semibold">{label}</div>
          <div className="max-h-64 overflow-auto p-2">
            {values.map((v) => {
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
                      if (c) next.add(v);
                      else next.delete(v);
                      onChange(next);
                    }}
                  />
                  <span className="truncate">{v}</span>
                </label>
              );
            })}
            {values.length === 0 && (
              <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                Sem valores disponíveis
              </div>
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
        className="rounded-r-full border border-l-0 border-border/60 bg-secondary/60 px-1.5 py-1 hover:bg-secondary"
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
      ? "before:bg-primary/60"
      : accent === "accent"
        ? "before:bg-accent/60"
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
        "relative min-h-[100px] overflow-hidden rounded-2xl border bg-card/30 p-3 transition-all",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:rounded-l-2xl",
        accentRing,
        dragOver
          ? "scale-[1.01] border-primary/60 bg-primary/5 shadow-lg shadow-primary/10"
          : "border-border/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-1.5">
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
      <div className="flex flex-wrap gap-1.5">{children}</div>
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
}: {
  pivot: ReturnType<typeof computePivot>;
  measures: PivotMeasure[];
  rowDims: string[];
  colDims: string[];
  dimMap: Map<string, DimMeta>;
}) {
  if (measures.length === 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 bg-card/20 text-sm">
        <Sigma className="h-8 w-8 text-muted-foreground/40" />
        <div className="text-muted-foreground">
          Adicione ao menos uma medida em <span className="font-semibold text-foreground">Valores</span>
        </div>
        <div className="text-[11px] text-muted-foreground/60">
          Arraste uma medida da paleta para começar
        </div>
      </div>
    );
  }

  const hasCols = colDims.length > 0 && pivot.colHeaders.length > 0;
  const cols = hasCols ? pivot.colHeaders : [{ key: "__all__", values: [], depth: 0, isLeaf: true }];

  // calcular max abs por medida (para barra de magnitude)
  const maxByMeasure = new Map<string, number>();
  for (const m of measures) {
    let max = 0;
    for (const rh of pivot.rowHeaders) {
      for (const c of cols) {
        const v = pivot.cells.get(rh.key)?.get(c.key)?.[m.id] ?? 0;
        if (isFinite(v)) max = Math.max(max, Math.abs(v));
      }
    }
    maxByMeasure.set(m.id, max);
  }

  function bgBar(m: PivotMeasure, v: number) {
    if (m.format === "percent") return undefined;
    const max = maxByMeasure.get(m.id) ?? 0;
    if (max === 0 || !isFinite(v) || v === 0) return undefined;
    const pct = Math.min(100, (Math.abs(v) / max) * 100);
    const color = toneAccentBar(m.tone, v);
    return {
      backgroundImage: `linear-gradient(to left, ${color} 0%, ${color} ${pct}%, transparent ${pct}%)`,
      backgroundSize: "100% 28%",
      backgroundPosition: "right bottom",
      backgroundRepeat: "no-repeat",
    } as React.CSSProperties;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/40 bg-card/30 shadow-sm">
      <div className="overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            {hasCols && (
              <tr>
                {rowDims.map((d) => (
                  <th
                    key={`rh-${d}`}
                    className="border-b border-border/40 bg-secondary/40 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {dimMap.get(d)?.label ?? d}
                  </th>
                ))}
                {rowDims.length === 0 && (
                  <th className="border-b border-border/40 bg-secondary/40 px-3 py-2.5" />
                )}
                {cols.map((c) => (
                  <th
                    key={`ch-${c.key}`}
                    colSpan={measures.length}
                    className="border-b border-l border-border/40 bg-secondary/40 px-3 py-2.5 text-center text-[11px] font-semibold"
                  >
                    {c.values.join(" · ") || "Total"}
                  </th>
                ))}
                <th
                  colSpan={measures.length}
                  className="border-b border-l-2 border-primary/30 bg-primary/10 px-3 py-2.5 text-center text-[11px] font-semibold text-primary"
                >
                  Total
                </th>
              </tr>
            )}
            <tr>
              {rowDims.map((d) => (
                <th
                  key={`rh2-${d}`}
                  className="sticky left-0 z-10 border-b border-border/40 bg-secondary/40 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {!hasCols && (dimMap.get(d)?.label ?? d)}
                </th>
              ))}
              {rowDims.length === 0 && !hasCols && (
                <th className="border-b border-border/40 bg-secondary/40 px-3 py-2" />
              )}
              {cols.map((c) =>
                measures.map((m) => (
                  <th
                    key={`mh-${c.key}-${m.id}`}
                    className={cn(
                      "border-b border-l border-border/40 bg-secondary/30 px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider",
                      toneClass(m.tone),
                    )}
                  >
                    {m.label}
                  </th>
                )),
              )}
              {hasCols &&
                measures.map((m) => (
                  <th
                    key={`th-total-${m.id}`}
                    className={cn(
                      "border-b border-l border-border/40 bg-primary/10 px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wider",
                      toneClass(m.tone),
                    )}
                  >
                    {m.label}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {pivot.rowHeaders.map((rh, i) => (
              <tr
                key={rh.key}
                className={cn(
                  "group border-b border-border/20 transition-colors hover:bg-primary/[0.04]",
                  i % 2 === 0 && "bg-background/30",
                )}
              >
                {rowDims.map((_, idx) => (
                  <td
                    key={`rv-${rh.key}-${idx}`}
                    className={cn(
                      "px-3 py-2 text-foreground",
                      idx === 0 && "font-medium",
                    )}
                  >
                    {rh.values[idx] ?? ""}
                  </td>
                ))}
                {rowDims.length === 0 && (
                  <td className="px-3 py-2 font-semibold text-muted-foreground">Total</td>
                )}
                {cols.map((c) => {
                  const cell = pivot.cells.get(rh.key)?.get(c.key) ?? {};
                  return measures.map((m) => {
                    const v = cell[m.id] ?? 0;
                    return (
                      <td
                        key={`v-${rh.key}-${c.key}-${m.id}`}
                        style={bgBar(m, v)}
                        className={cn(
                          "border-l border-border/15 px-3 py-2 text-right tabular-nums transition-colors",
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
                          "border-l border-primary/20 bg-primary/5 px-3 py-2 text-right font-semibold tabular-nums",
                          toneClass(m.tone, v),
                        )}
                      >
                        {fmtValue(m, v)}
                      </td>
                    );
                  })}
              </tr>
            ))}

            {/* Footer total */}
            <tr className="border-t-2 border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 font-semibold">
              {rowDims.map((_, idx) => (
                <td key={`ft-${idx}`} className="px-3 py-2.5 text-foreground">
                  {idx === 0 ? "Total geral" : ""}
                </td>
              ))}
              {rowDims.length === 0 && <td className="px-3 py-2.5">Total</td>}
              {cols.map((c) =>
                measures.map((m) => {
                  const v = pivot.colTotals.get(c.key)?.[m.id] ?? 0;
                  return (
                    <td
                      key={`ct-${c.key}-${m.id}`}
                      className={cn(
                        "border-l border-border/40 px-3 py-2.5 text-right tabular-nums",
                        toneClass(m.tone, v),
                      )}
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
                        "border-l-2 border-primary/40 bg-primary/15 px-3 py-2.5 text-right tabular-nums",
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

      {pivot.rowHeaders.length === 0 && (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Sem dados para a configuração atual.
        </div>
      )}
    </div>
  );
}

// silence: ALL_DIMENSIONS reference is for typing — keep tree-shake safe
void ALL_DIMENSIONS;
type _UR = UnifiedRow;
