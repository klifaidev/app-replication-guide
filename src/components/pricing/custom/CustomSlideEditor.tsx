// CustomSlideEditor — canvas WYSIWYG para o slide "Personalizado".
// Usa react-rnd para drag + resize. Snap-to-grid de 10px. O canvas
// renderiza no sistema 1333x750 e é escalado via CSS para caber no painel.

import { useEffect, useMemo, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDown, ArrowUp, Copy as CopyIcon, GitBranch, Image as ImageIcon,
  Layers as LayersIcon, MinusSquare, Plus, Square, Table as TableIcon,
  Trash2, Type as TypeIcon, AlignLeft, ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

import {
  CANVAS_W, CANVAS_H, FOOTER_H,
  newBlock, BLOCK_LABELS,
  type CustomBlock, type CustomBlockKind, type CustomSlideConfig,
} from "@/lib/customSlide";
import { BlockRenderer, CUSTOM_TABLE_MEASURES, CUSTOM_TABLE_DIMS } from "./BlockRenderer";
import { useMonthsInfo, useFyList } from "@/store/selectors";
import { cn } from "@/lib/utils";
import haraldFooterPng from "@/assets/harald-footer-bar.png";

const BLOCK_KINDS: { kind: CustomBlockKind; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: "title",  icon: TypeIcon },
  { kind: "text",   icon: AlignLeft },
  { kind: "kpi",    icon: LayersIcon },
  { kind: "bridge", icon: GitBranch },
  { kind: "table",  icon: TableIcon },
  { kind: "image",  icon: ImageIcon },
  { kind: "shape",  icon: Square },
];

interface Props {
  config: CustomSlideConfig;
  onChange: (next: CustomSlideConfig) => void;
  /** Necessário para o exporter capturar o canvas em PNG */
  canvasRef?: React.RefObject<HTMLDivElement>;
}

export function CustomSlideEditor({ config, onChange, canvasRef }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const internalCanvasRef = useRef<HTMLDivElement>(null);
  const ref = canvasRef ?? internalCanvasRef;

  // Auto-scale para caber no contêiner
  useEffect(() => {
    function compute() {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const s = Math.min(rect.width / CANVAS_W, rect.height / CANVAS_H, 1);
      setScale(s > 0 ? s : 1);
    }
    compute();
    const ro = new ResizeObserver(compute);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  const selected = config.blocks.find((b) => b.id === selectedId) ?? null;
  const zTop = config.blocks.reduce((m, b) => Math.max(m, b.z), 0);

  const update = (next: CustomBlock[]) => onChange({ ...config, blocks: next });
  const updateBlock = (id: string, patch: Partial<CustomBlock>) =>
    update(config.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as CustomBlock) : b)));
  const addBlock = (kind: CustomBlockKind) => {
    const blk = newBlock(kind, zTop);
    update([...config.blocks, blk]);
    setSelectedId(blk.id);
  };
  const removeBlock = (id: string) => {
    update(config.blocks.filter((b) => b.id !== id));
    setSelectedId(null);
  };
  const duplicateBlock = (id: string) => {
    const orig = config.blocks.find((b) => b.id === id);
    if (!orig) return;
    const clone = { ...JSON.parse(JSON.stringify(orig)), id: crypto.randomUUID(),
      x: orig.x + 20, y: orig.y + 20, z: zTop + 1 } as CustomBlock;
    update([...config.blocks, clone]);
    setSelectedId(clone.id);
  };
  const bringForward = (id: string) =>
    updateBlock(id, { z: zTop + 1 } as Partial<CustomBlock>);
  const sendBack = (id: string) => {
    const minZ = config.blocks.reduce((m, b) => Math.min(m, b.z), 0);
    updateBlock(id, { z: minZ - 1 } as Partial<CustomBlock>);
  };

  return (
    <div className="grid h-full grid-cols-[180px_1fr_300px] gap-3">
      {/* ====== Paleta ====== */}
      <div className="flex flex-col gap-1 rounded-lg border border-border/40 bg-card/40 p-2">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Adicionar bloco
        </div>
        {BLOCK_KINDS.map(({ kind, icon: Icon }) => (
          <button
            key={kind}
            onClick={() => addBlock(kind)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-left hover:bg-secondary"
          >
            <Icon className="h-3.5 w-3.5 text-primary" />
            {BLOCK_LABELS[kind]}
          </button>
        ))}
        <Separator className="my-2" />
        <div className="flex items-center justify-between px-2 text-[11px]">
          <span className="text-muted-foreground">Faixa Harald</span>
          <Switch
            checked={config.showHaraldFooter}
            onCheckedChange={(v) => onChange({ ...config, showHaraldFooter: v })}
          />
        </div>
      </div>

      {/* ====== Canvas ====== */}
      <div ref={wrapperRef}
        className="relative flex items-center justify-center overflow-hidden rounded-lg border border-border/40 bg-secondary/20"
        style={{ minHeight: 360 }}
        onClick={() => setSelectedId(null)}
      >
        <div
          ref={ref}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: CANVAS_W, height: CANVAS_H,
            transform: `scale(${scale})`, transformOrigin: "center",
            background: `#${config.background}`,
            position: "relative", boxShadow: "0 10px 40px hsl(0 0% 0% / 0.25)",
            overflow: "hidden",
          }}
        >
          {[...config.blocks].sort((a, b) => a.z - b.z).map((blk) => (
            <Rnd
              key={blk.id}
              size={{ width: blk.w, height: blk.h }}
              position={{ x: blk.x, y: blk.y }}
              bounds="parent"
              dragGrid={[10, 10]}
              resizeGrid={[10, 10]}
              onDragStop={(_, d) => updateBlock(blk.id, { x: d.x, y: d.y })}
              onResizeStop={(_, __, refEl, ___, pos) =>
                updateBlock(blk.id, {
                  w: parseInt(refEl.style.width, 10),
                  h: parseInt(refEl.style.height, 10),
                  x: pos.x, y: pos.y,
                })
              }
              onMouseDown={(e) => { e.stopPropagation(); setSelectedId(blk.id); }}
              style={{ zIndex: blk.z }}
              className={cn(
                "group/block",
                selectedId === blk.id
                  ? "outline outline-2 outline-offset-1 outline-primary"
                  : "outline outline-1 outline-transparent hover:outline-primary/40",
              )}
            >
              <div style={{ width: "100%", height: "100%", pointerEvents: "none" }}>
                <BlockRenderer block={blk} />
              </div>
            </Rnd>
          ))}

          {/* Faixa Harald (não editável, sempre por cima) */}
          {config.showHaraldFooter && (
            <img
              src={haraldFooterPng}
              alt=""
              style={{
                position: "absolute", left: 0, bottom: 0,
                width: CANVAS_W, height: FOOTER_H,
                pointerEvents: "none", zIndex: 99999,
              }}
            />
          )}
        </div>

        <div className="pointer-events-none absolute bottom-2 right-3 rounded bg-background/70 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
          {Math.round(scale * 100)}%
        </div>
      </div>

      {/* ====== Inspector ====== */}
      <ScrollArea className="rounded-lg border border-border/40 bg-card/40">
        <div className="space-y-3 p-3">
          {!selected ? (
            <div className="space-y-2 px-1 text-[12px] text-muted-foreground">
              <p className="font-medium text-foreground">Slide personalizado</p>
              <p>Adicione blocos pela paleta à esquerda. Clique em um bloco para editar suas propriedades aqui.</p>
              <p>Arraste pelas bordas para mover, use os cantos para redimensionar. Snap de 10px.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px]">{BLOCK_LABELS[selected.kind]}</Badge>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => bringForward(selected.id)} title="Trazer pra frente">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => sendBack(selected.id)} title="Enviar pra trás">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateBlock(selected.id)} title="Duplicar">
                    <CopyIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => removeBlock(selected.id)} title="Remover">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <PositionInputs block={selected} onChange={(p) => updateBlock(selected.id, p)} />
              <Separator />
              <BlockSpecificEditor block={selected} onChange={(p) => updateBlock(selected.id, p)} />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
function PositionInputs({ block, onChange }: {
  block: CustomBlock; onChange: (p: Partial<CustomBlock>) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {(["x", "y", "w", "h"] as const).map((k) => (
        <div key={k}>
          <Label className="text-[9px] uppercase text-muted-foreground">{k}</Label>
          <Input
            type="number"
            className="h-7 px-1.5 text-[11px]"
            value={block[k]}
            onChange={(e) => onChange({ [k]: parseInt(e.target.value, 10) || 0 } as never)}
          />
        </div>
      ))}
    </div>
  );
}

function BlockSpecificEditor({ block, onChange }: {
  block: CustomBlock; onChange: (p: Partial<CustomBlock>) => void;
}) {
  switch (block.kind) {
    case "title":
    case "text": {
      const isTitle = block.kind === "title";
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Conteúdo</Label>
            <Textarea
              rows={isTitle ? 2 : 4}
              value={block.text}
              onChange={(e) => onChange({ text: e.target.value } as never)}
              className="text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Tamanho</Label>
              <Input type="number" className="h-7 text-xs"
                value={block.size}
                onChange={(e) => onChange({ size: parseInt(e.target.value, 10) || 14 } as never)}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase text-muted-foreground">Cor (hex)</Label>
              <Input className="h-7 text-xs" value={block.color}
                onChange={(e) => onChange({ color: e.target.value.replace("#", "") } as never)}
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Alinhamento</Label>
            <Select value={block.align}
              onValueChange={(v) => onChange({ align: v as "left"|"center"|"right" } as never)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Esquerda</SelectItem>
                <SelectItem value="center">Centro</SelectItem>
                <SelectItem value="right">Direita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isTitle && (
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase text-muted-foreground">Negrito</Label>
              <Switch checked={(block as { bold: boolean }).bold}
                onCheckedChange={(v) => onChange({ bold: v } as never)} />
            </div>
          )}
        </div>
      );
    }

    case "kpi":
      return (
        <div className="space-y-2">
          <Field label="Rótulo" value={block.label}
            onChange={(v) => onChange({ label: v } as never)} />
          <Field label="Valor" value={block.value}
            onChange={(v) => onChange({ value: v } as never)} />
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Tamanho do valor" value={block.valueSize}
              onChange={(v) => onChange({ valueSize: v } as never)} />
            <Field label="Cor (hex)" value={block.color}
              onChange={(v) => onChange({ color: v.replace("#", "") } as never)} />
          </div>
        </div>
      );

    case "image":
      return (
        <div className="space-y-2">
          <Label className="text-[10px] uppercase text-muted-foreground">Upload</Label>
          <input type="file" accept="image/*"
            className="text-[11px]"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = () => onChange({ src: String(reader.result) } as never);
              reader.readAsDataURL(f);
            }}
          />
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Ajuste</Label>
            <Select value={block.fit} onValueChange={(v) => onChange({ fit: v as "contain"|"cover" } as never)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">Conter</SelectItem>
                <SelectItem value="cover">Cobrir</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case "shape":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-[10px] uppercase text-muted-foreground">Forma</Label>
            <Select value={block.shape} onValueChange={(v) => onChange({ shape: v as "rect"|"line" } as never)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rect">Retângulo</SelectItem>
                <SelectItem value="line">Linha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cor (hex)" value={block.fill}
              onChange={(v) => onChange({ fill: v.replace("#", "") } as never)} />
            <NumField label="Raio" value={block.radius}
              onChange={(v) => onChange({ radius: v } as never)} />
          </div>
        </div>
      );

    case "bridge":
      return <BridgeBlockEditor block={block} onChange={onChange} />;

    case "table":
      return <TableBlockEditor block={block} onChange={onChange} />;
  }
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <Input className="h-7 text-xs" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <Label className="text-[10px] uppercase text-muted-foreground">{label}</Label>
      <Input type="number" className="h-7 text-xs" value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)} />
    </div>
  );
}

function BridgeBlockEditor({ block, onChange }: {
  block: Extract<CustomBlock, { kind: "bridge" }>;
  onChange: (p: Partial<CustomBlock>) => void;
}) {
  const months = useMonthsInfo();
  const fyList = useFyList();
  const opts = block.mode === "fy"
    ? fyList.map((f) => ({ value: f, label: f }))
    : months.map((m) => ({ value: m.periodo, label: m.label }));
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">Modo</Label>
        <Select value={block.mode}
          onValueChange={(v) => onChange({ mode: v as "fy"|"month", base: null, comp: null } as never)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mês a mês</SelectItem>
            <SelectItem value="fy">Ano fiscal</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Base</Label>
          <Select value={block.base ?? ""} onValueChange={(v) => onChange({ base: v } as never)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="..." /></SelectTrigger>
            <SelectContent>
              {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase text-muted-foreground">Comparação</Label>
          <Select value={block.comp ?? ""} onValueChange={(v) => onChange({ comp: v } as never)}>
            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="..." /></SelectTrigger>
            <SelectContent>
              {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function TableBlockEditor({ block, onChange }: {
  block: Extract<CustomBlock, { kind: "table" }>;
  onChange: (p: Partial<CustomBlock>) => void;
}) {
  const dims = CUSTOM_TABLE_DIMS;
  const toggleMeasure = (id: string) => {
    const next = block.measures.includes(id)
      ? block.measures.filter((m) => m !== id)
      : [...block.measures, id];
    onChange({ measures: next } as never);
  };
  const toggleRowDim = (id: string) => {
    const next = block.rowDims.includes(id)
      ? block.rowDims.filter((d) => d !== id)
      : [...block.rowDims, id];
    onChange({ rowDims: next } as never);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">Linhas (dimensões)</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 w-full justify-start text-xs">
              {block.rowDims.length ? block.rowDims.map((d) => dims.find((x) => x.id === d)?.label).join(", ") : "Selecionar..."}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="max-h-72 w-64 overflow-auto p-2" align="start">
            {dims.map((d) => (
              <button key={d.id as string}
                onClick={() => toggleRowDim(d.id as string)}
                className={cn(
                  "flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-secondary",
                  block.rowDims.includes(d.id as string) && "bg-primary/10 text-primary",
                )}
              >
                <span>{d.label}</span>
                <span className="text-[9px] text-muted-foreground">{d.group}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">Coluna (opcional)</Label>
        <Select value={block.colDim ?? "__none__"}
          onValueChange={(v) => onChange({ colDim: v === "__none__" ? null : v } as never)}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">— Sem coluna —</SelectItem>
            {dims.map((d) => <SelectItem key={d.id as string} value={d.id as string}>{d.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-[10px] uppercase text-muted-foreground">Medidas</Label>
        <div className="space-y-1">
          {CUSTOM_TABLE_MEASURES.map((m) => (
            <button key={m.id}
              onClick={() => toggleMeasure(m.id)}
              className={cn(
                "flex w-full items-center justify-between rounded px-2 py-1 text-xs hover:bg-secondary",
                block.measures.includes(m.id) && "bg-primary/10 text-primary",
              )}
            >
              <span>{m.label}</span>
              {block.measures.includes(m.id) && <span className="text-[9px]">✓</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
