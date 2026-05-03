// ============================================================================
// Slides (Beta) — orquestrador de exportação multi-slide
//
// Fluxo:
//  1. Usuário arrasta slides do "Catálogo" para a "Esteira" (drop zone)
//  2. Cada slide tem painel de configuração próprio (filtros + parâmetros)
//  3. Pode salvar a esteira como Pré-definição (localStorage)
//  4. Exporta tudo num único PPTX preservando a ordem
// ============================================================================
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelectFilter } from "@/components/pricing/MultiSelectFilter";
import { toast } from "sonner";
import {
  ArrowRight, BookOpen, Bookmark, Copy, Download, Filter as FilterIcon,
  GitBranch, GripVertical, Layers, Plus, RotateCcw, Save, Sparkles, Target, Trash2, X,
} from "lucide-react";

import { usePricing } from "@/store/pricing";
import { useBudget } from "@/store/budget";
import { useFyList, useMonthsInfo } from "@/store/selectors";
import { useSlidesFlow } from "@/store/slidesFlow";
import {
  SLIDE_CATALOG, defaultItem, isItemReady, itemToFlow, metaOf,
  type SlideItem, type SlideKind,
} from "@/lib/slidesFlow";
import { exportSlideFlow } from "@/lib/exportPpt";
import { cn } from "@/lib/utils";
import type { Filters, FilterKey, PricingRow } from "@/lib/types";
import type { BudgetRow } from "@/lib/budget";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------
const ICON_MAP = { GitBranch, Target, BookOpen } as const;

const ACCENT_BG = {
  blue: "bg-primary/15 text-primary border-primary/30",
  amber: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  neutral: "bg-muted text-muted-foreground border-border/40",
} as const;

// Dimensões disponíveis para filtros por slide.
// Cada grupo é mostrado como um collapsible no painel.
const FILTER_GROUPS: Array<{
  title: string;
  variant: "comercial" | "sku" | "inovacao";
  keys: FilterKey[];
}> = [
  {
    title: "Comercial",
    variant: "comercial",
    keys: ["canal", "canalAjustado", "regiao", "uf", "regional", "mercado", "mercadoAjustado"],
  },
  {
    title: "Produto",
    variant: "sku",
    keys: ["marca", "categoria", "subcategoria", "formato", "sabor", "tecnologia", "faixaPeso", "sku"],
  },
  {
    title: "Inovação",
    variant: "inovacao",
    keys: ["inovacao", "legado"],
  },
];

const FILTER_LABEL: Record<FilterKey, string> = {
  marca: "Marca",
  canal: "Canal",
  canalAjustado: "Canal Ajustado",
  categoria: "Categoria",
  subcategoria: "Subcategoria",
  formato: "Formato",
  sku: "SKU",
  regiao: "Região",
  uf: "UF",
  regional: "Regional",
  mercado: "Mercado",
  mercadoAjustado: "Mercado Ajustado",
  sabor: "Sabor",
  tecnologia: "Tecnologia",
  faixaPeso: "Faixa de Peso",
  inovacao: "Inovação",
  legado: "Legado",
};

function uniqueValues(
  pricing: PricingRow[],
  budget: BudgetRow[],
  key: FilterKey,
): string[] {
  const set = new Set<string>();
  for (const r of pricing) {
    const v = (r as Record<string, unknown>)[key];
    if (typeof v === "string" && v) set.add(v);
  }
  for (const r of budget) {
    const v = (r as Record<string, unknown>)[key];
    if (typeof v === "string" && v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// ----------------------------------------------------------------------------
// Drop zone vazio
// ----------------------------------------------------------------------------
function EmptyFlow({ onAdd }: { onAdd: (k: SlideKind) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-border/50 bg-secondary/10 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-medium">Comece sua apresentação</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          Adicione slides do catálogo à esquerda. Reordene arrastando, configure filtros independentes por slide e exporte tudo em um único PPTX.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SLIDE_CATALOG.map((s) => {
          const Icon = ICON_MAP[s.icon];
          return (
            <Button key={s.kind} variant="outline" size="sm" className="gap-2" onClick={() => onAdd(s.kind)}>
              <Icon className="h-4 w-4" /> {s.title}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Card sortable na esteira
// ----------------------------------------------------------------------------
function FlowCard({
  item,
  index,
  selected,
  onSelect,
  onRemove,
  onDuplicate,
}: {
  item: SlideItem;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
}) {
  const meta = metaOf(item.kind);
  const Icon = ICON_MAP[meta.icon];
  const ready = isItemReady(item);
  const filtersCount = item.kind !== "cover"
    ? Object.values(item.config.filters).filter((v) => v && v.length > 0).length
    : 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border bg-card/60 p-3 transition-all",
        selected
          ? "border-primary/60 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.4)]"
          : "border-border/40 hover:border-border/70 hover:bg-card",
      )}
      onClick={onSelect}
    >
      <button
        className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", ACCENT_BG[meta.accent])}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            #{index + 1}
          </span>
          <span className="truncate text-sm font-medium">
            {item.label || meta.title}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{meta.title}</span>
          {filtersCount > 0 && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5">
                <FilterIcon className="h-3 w-3" /> {filtersCount}
              </span>
            </>
          )}
          {!ready.ok && (
            <>
              <span>·</span>
              <span className="text-warning">{ready.reason}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost" size="icon" className="h-7 w-7"
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          aria-label="Duplicar"
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Painel de configuração de filtros
// ----------------------------------------------------------------------------
function FiltersPanel({
  value,
  onChange,
  pricing,
  budget,
}: {
  value: Filters;
  onChange: (next: Filters) => void;
  pricing: PricingRow[];
  budget: BudgetRow[];
}) {
  const setKey = (k: FilterKey, vals: string[]) => {
    const next = { ...value };
    if (vals.length === 0) delete next[k];
    else next[k] = vals;
    onChange(next);
  };

  const activeCount = Object.values(value).filter((v) => v && v.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FilterIcon className="h-4 w-4 text-primary" />
          Filtros do slide
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
              {activeCount} ativo(s)
            </Badge>
          )}
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onChange({})}>
            <X className="h-3 w-3" /> Limpar
          </Button>
        )}
      </div>

      <Tabs defaultValue={FILTER_GROUPS[0].title} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary/40">
          {FILTER_GROUPS.map((g) => (
            <TabsTrigger key={g.title} value={g.title} className="text-xs">
              {g.title}
            </TabsTrigger>
          ))}
        </TabsList>
        {FILTER_GROUPS.map((g) => (
          <TabsContent key={g.title} value={g.title} className="mt-3 space-y-3">
            {g.keys.map((k) => {
              const opts = uniqueValues(pricing, budget, k).map((v) => ({ value: v, label: v }));
              if (opts.length === 0) return null;
              return (
                <div key={k} className="space-y-1">
                  <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {FILTER_LABEL[k]}
                  </Label>
                  <MultiSelectFilter
                    options={opts}
                    selected={value[k] ?? []}
                    onChange={(vals) => setKey(k, vals)}
                    variant={g.variant}
                  />
                </div>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Painéis de configuração específicos por tipo
// ----------------------------------------------------------------------------
function BridgePvmConfigPanel({
  item, onChange,
}: {
  item: Extract<SlideItem, { kind: "bridge_pvm" }>;
  onChange: (next: SlideItem) => void;
}) {
  const fyList = useFyList();
  const months = useMonthsInfo();
  const cfg = item.config;

  const options = cfg.mode === "fy"
    ? fyList.map((f) => ({ value: f, label: f }))
    : months.map((m) => ({ value: m.periodo, label: m.label }));

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Modo</Label>
        <Select
          value={cfg.mode}
          onValueChange={(v) => onChange({ ...item, config: { ...cfg, mode: v as "fy" | "month", base: null, comp: null } })}
        >
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês a mês</SelectItem>
            <SelectItem value="fy">Ano fiscal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Base</Label>
          <Select
            value={cfg.base ?? undefined}
            onValueChange={(v) => onChange({ ...item, config: { ...cfg, base: v } })}
          >
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Escolha..." /></SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.value === cfg.comp}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ArrowRight className="mb-2 h-4 w-4 text-muted-foreground" />
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Comparação</Label>
          <Select
            value={cfg.comp ?? undefined}
            onValueChange={(v) => onChange({ ...item, config: { ...cfg, comp: v } })}
          >
            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Escolha..." /></SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value} disabled={o.value === cfg.base}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function BudgetEvoConfigPanel({
  item, onChange,
}: {
  item: Extract<SlideItem, { kind: "budget_evo" }>;
  onChange: (next: SlideItem) => void;
}) {
  const budgetRows = useBudget((s) => s.rows);
  const months = useMemo(() => {
    const map = new Map<string, { periodo: string; mes: number; ano: number; label: string }>();
    for (const r of budgetRows) {
      if (!map.has(r.periodo)) {
        map.set(r.periodo, { periodo: r.periodo, mes: r.mes, ano: r.ano, label: `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][r.mes-1]}/${String(r.ano).slice(-2)}` });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  }, [budgetRows]);

  const cfg = item.config;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Mês inicial</Label>
        <Select
          value={cfg.start ?? "__auto__"}
          onValueChange={(v) => onChange({ ...item, config: { ...cfg, start: v === "__auto__" ? null : v } })}
        >
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto__">Automático (FY anterior)</SelectItem>
            {months.map((m) => <SelectItem key={m.periodo} value={m.periodo}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Mês final</Label>
        <Select
          value={cfg.end ?? "__auto__"}
          onValueChange={(v) => onChange({ ...item, config: { ...cfg, end: v === "__auto__" ? null : v } })}
        >
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__auto__">Automático (último disponível)</SelectItem>
            {months.map((m) => <SelectItem key={m.periodo} value={m.periodo}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function CoverConfigPanel({
  item, onChange,
}: {
  item: Extract<SlideItem, { kind: "cover" }>;
  onChange: (next: SlideItem) => void;
}) {
  const cfg = item.config;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Estilo</Label>
        <Select
          value={cfg.variant}
          onValueChange={(v) => onChange({ ...item, config: { ...cfg, variant: v as "cover" | "divider" } })}
        >
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cover">Capa principal (vermelha)</SelectItem>
            <SelectItem value="divider">Divisor de seção (branco)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Título</Label>
        <Input
          value={cfg.title}
          onChange={(e) => onChange({ ...item, config: { ...cfg, title: e.target.value } })}
          className="h-9 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Subtítulo (opcional)</Label>
        <Textarea
          value={cfg.subtitle ?? ""}
          onChange={(e) => onChange({ ...item, config: { ...cfg, subtitle: e.target.value } })}
          rows={2}
          className="text-sm resize-none"
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Painel direito (inspector) — depende do slide selecionado
// ----------------------------------------------------------------------------
function Inspector({ item }: { item: SlideItem | null }) {
  const updateItem = useSlidesFlow((s) => s.updateItem);
  const pricing = usePricing((s) => s.rows);
  const budget = useBudget((s) => s.rows);

  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
        <Layers className="h-8 w-8 opacity-40" />
        <p className="text-sm">Selecione um slide para configurar.</p>
      </div>
    );
  }

  const meta = metaOf(item.kind);
  const Icon = ICON_MAP[meta.icon];

  return (
    <ScrollArea className="h-full">
      <div className="space-y-5 p-5">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", ACCENT_BG[meta.accent])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{meta.title}</div>
            <Input
              value={item.label ?? ""}
              onChange={(e) => updateItem(item.id, (it) => ({ ...it, label: e.target.value } as SlideItem))}
              placeholder={meta.title}
              className="-ml-2 h-8 border-transparent bg-transparent px-2 text-base font-medium hover:bg-secondary/40 focus-visible:bg-card"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{meta.description}</p>
          </div>
        </div>

        <Separator />

        {item.kind === "bridge_pvm" && (
          <BridgePvmConfigPanel item={item} onChange={(next) => updateItem(item.id, () => next)} />
        )}
        {item.kind === "budget_evo" && (
          <BudgetEvoConfigPanel item={item} onChange={(next) => updateItem(item.id, () => next)} />
        )}
        {item.kind === "cover" && (
          <CoverConfigPanel item={item} onChange={(next) => updateItem(item.id, () => next)} />
        )}

        {meta.supportsFilters && item.kind !== "cover" && (
          <>
            <Separator />
            <FiltersPanel
              value={item.config.filters}
              onChange={(filters) => updateItem(item.id, (it) => {
                if (it.kind === "cover") return it;
                return { ...it, config: { ...it.config, filters } } as SlideItem;
              })}
              pricing={pricing}
              budget={budget}
            />
          </>
        )}
      </div>
    </ScrollArea>
  );
}

// ----------------------------------------------------------------------------
// Diálogos de presets
// ----------------------------------------------------------------------------
function SavePresetDialog() {
  const items = useSlidesFlow((s) => s.items);
  const savePreset = useSlidesFlow((s) => s.savePreset);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={items.length === 0}>
          <Save className="h-4 w-4" /> Salvar pré-definição
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar pré-definição</DialogTitle>
          <DialogDescription>
            Capture esta esteira de {items.length} slide(s) para reutilizar em apresentações futuras.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Check semanal de resultado"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Notas sobre quando usar esta pré-definição"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              const p = savePreset(name, description);
              toast.success(`Pré-definição "${p.name}" salva.`);
              setName(""); setDescription("");
              setOpen(false);
            }}
            disabled={!name.trim()}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PresetsPanel() {
  const presets = useSlidesFlow((s) => s.presets);
  const loadPreset = useSlidesFlow((s) => s.loadPreset);
  const deletePreset = useSlidesFlow((s) => s.deletePreset);
  const overwritePreset = useSlidesFlow((s) => s.overwritePreset);

  if (presets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/50 bg-secondary/10 px-4 py-6 text-center text-xs text-muted-foreground">
        Nenhuma pré-definição salva ainda.
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      {presets
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((p) => (
          <div key={p.id} className="group flex items-center gap-2 rounded-lg border border-border/40 bg-card/50 p-2 transition-colors hover:border-border/70">
            <Bookmark className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{p.name}</div>
              <div className="text-[10px] text-muted-foreground">
                {p.items.length} slide(s) · {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
              </div>
            </div>
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              title="Carregar"
              onClick={() => { loadPreset(p.id); toast.success(`"${p.name}" carregado.`); }}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-6 w-6"
              title="Sobrescrever com a esteira atual"
              onClick={() => { overwritePreset(p.id); toast.success(`"${p.name}" atualizado.`); }}
            >
              <Save className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive"
              title="Excluir"
              onClick={() => { if (confirm(`Excluir "${p.name}"?`)) deletePreset(p.id); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Página
// ----------------------------------------------------------------------------
export default function SlidesBeta() {
  const items = useSlidesFlow((s) => s.items);
  const selectedId = useSlidesFlow((s) => s.selectedId);
  const select = useSlidesFlow((s) => s.select);
  const addItem = useSlidesFlow((s) => s.addItem);
  const removeItem = useSlidesFlow((s) => s.removeItem);
  const duplicateItem = useSlidesFlow((s) => s.duplicateItem);
  const reorder = useSlidesFlow((s) => s.reorder);
  const clearItems = useSlidesFlow((s) => s.clearItems);

  const pricingRows = usePricing((s) => s.rows);
  const budgetRows = useBudget((s) => s.rows);
  const metric = usePricing((s) => s.metric);

  const [exporting, setExporting] = useState(false);
  const [fileName, setFileName] = useState("apresentacao-pricing.pptx");

  const selected = useMemo(() => items.find((i) => i.id === selectedId) ?? null, [items, selectedId]);
  const readyAll = items.every((i) => isItemReady(i).ok);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    reorder(String(active.id), String(over.id));
  };

  const handleExport = async () => {
    if (items.length === 0) return;
    if (!readyAll) {
      toast.error("Existem slides incompletos. Configure-os antes de exportar.");
      return;
    }
    setExporting(true);
    try {
      const flow = items.map((i) => itemToFlow(i, { pricingRows, budgetRows, metric }));
      const safeName = fileName.endsWith(".pptx") ? fileName : `${fileName}.pptx`;
      await exportSlideFlow(flow, safeName);
      toast.success(`PPTX gerado com ${items.length} slide(s).`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Falha ao gerar PPTX.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Topbar
        title="Slides (Beta)"
        subtitle="Monte uma apresentação combinando slides com filtros independentes"
      />
      <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[260px_1fr_360px] gap-0 overflow-hidden">
        {/* ===== Coluna esquerda: catálogo + presets ===== */}
        <aside className="flex flex-col gap-4 border-r border-border/40 bg-sidebar/40 p-4">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Layers className="h-3 w-3" /> Catálogo
            </div>
            <div className="space-y-1.5">
              {SLIDE_CATALOG.map((s) => {
                const Icon = ICON_MAP[s.icon];
                return (
                  <button
                    key={s.kind}
                    onClick={() => addItem(s.kind)}
                    className="group flex w-full items-start gap-3 rounded-xl border border-border/40 bg-card/40 p-3 text-left transition-all hover:-translate-y-px hover:border-primary/40 hover:bg-card hover:shadow-sm"
                  >
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", ACCENT_BG[s.accent])}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-medium">{s.title}</span>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-primary" />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{s.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <Bookmark className="h-3 w-3" /> Pré-definições
            </div>
            <ScrollArea className="h-full pr-1">
              <PresetsPanel />
            </ScrollArea>
          </div>
        </aside>

        {/* ===== Coluna central: esteira ===== */}
        <main className="flex flex-col overflow-hidden bg-background/60">
          {/* Header da esteira */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 bg-card/30 px-6 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium">Esteira de slides</h2>
              <Badge variant="secondary" className="text-[10px]">{items.length} slide(s)</Badge>
              {!readyAll && items.length > 0 && (
                <Badge variant="outline" className="border-warning/40 text-warning text-[10px]">
                  Há slides incompletos
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="h-8 w-56 text-xs"
                placeholder="nome-do-arquivo.pptx"
              />
              <SavePresetDialog />
              {items.length > 0 && (
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={() => {
                  if (confirm("Limpar a esteira atual?")) clearItems();
                }}>
                  <X className="h-4 w-4" /> Limpar
                </Button>
              )}
              <Button
                size="sm" className="gap-2"
                disabled={items.length === 0 || exporting || !readyAll}
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                {exporting ? "Gerando..." : "Exportar PPTX"}
              </Button>
            </div>
          </div>

          {/* Conteúdo da esteira */}
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-3xl p-6">
              {items.length === 0 ? (
                <EmptyFlow onAdd={addItem} />
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {items.map((item, idx) => (
                        <FlowCard
                          key={item.id}
                          item={item}
                          index={idx}
                          selected={selectedId === item.id}
                          onSelect={() => select(item.id)}
                          onRemove={() => removeItem(item.id)}
                          onDuplicate={() => duplicateItem(item.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </ScrollArea>
        </main>

        {/* ===== Coluna direita: inspector ===== */}
        <aside className="border-l border-border/40 bg-sidebar/40">
          <Inspector item={selected} />
        </aside>
      </div>
    </>
  );
}
