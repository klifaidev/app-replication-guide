// Exportador do slide "Personalizado" para PPTX — modo NATIVO.
// Cada bloco vira um elemento editável do PowerPoint (texto, forma,
// imagem, tabela ou gráfico). A Bridge é capturada como PNG fiel ao canvas
// (mantém o visual de waterfall) — os demais blocos seguem editáveis.

import type PptxGenJS from "pptxgenjs";
import { toPng } from "html-to-image";
import { CANVAS_W, CANVAS_H, type CustomSlideConfig, type CustomBlock,
  type TitleBlock, type TextBlock, type KpiBlock, type ImageBlock,
  type ShapeBlock, type BridgeBlock, type TableBlock, type ChartBlock,
  type TopSkuBlock, KPI_MEASURES } from "./customSlide";
import haraldFooterPng from "@/assets/harald-footer-bar.png";
import { usePricing } from "@/store/pricing";
import { useBudget } from "@/store/budget";
import { applyFilters, calcPVM } from "./analytics";
import { computePivot, type PivotConfig, type PivotMeasure } from "./pivot";
import { buildUnifiedRows, ALL_DIMENSIONS } from "./pivotData";
import { computeKpiBlock, computeChartSeries, computeTopRanking,
  formatValue, inferFormat } from "./customKpi";
import { monthLabel, formatBRL } from "./format";
import { resolveTableFit, resolveChartFit, resolveTopSkuFit } from "./customCapacity";
import { getCustomCanvas } from "./customCanvasRegistry";

const SLIDE_W_IN = 13.33;
const SLIDE_H_IN = 7.5;
const FOOTER_H_IN = 0.85;

// Conversão coordenadas-canvas → polegadas. Canvas 1333x750 → 13.33"x7.5".
const SX = SLIDE_W_IN / CANVAS_W; // ≈ 0.01
const SY = SLIDE_H_IN / CANVAS_H;

const BOX = (b: CustomBlock) => ({
  x: b.x * SX, y: b.y * SY, w: b.w * SX, h: b.h * SY,
});

const TABLE_MEASURES: PivotMeasure[] = [
  { id: "rol_real",   label: "ROL",            field: "rol_real",           agg: "sum", format: "currency", tone: "real" },
  { id: "vol_real",   label: "Volume (Kg)",    field: "volumeKg_real",      agg: "sum", format: "tons",     tone: "real" },
  { id: "cm_real",    label: "Contrib. Marg.", field: "cm_real",            agg: "sum", format: "currency", tone: "real" },
  { id: "cv_real",    label: "Custo Variável", field: "custoVariavel_real", agg: "sum", format: "currency", tone: "real" },
  { id: "frete_real", label: "Frete",          field: "frete_real",         agg: "sum", format: "currency", tone: "real" },
  { id: "com_real",   label: "Comissão",       field: "comissao_real",      agg: "sum", format: "currency", tone: "real" },
  { id: "mb_real",    label: "Margem Bruta",   field: "mb_real",            agg: "sum", format: "currency", tone: "real" },
];

function fmtMeasure(m: PivotMeasure, v: number): string {
  if (!isFinite(v)) return "—";
  if (m.format === "currency") return formatBRL(v);
  if (m.format === "percent") return `${(v * 100).toFixed(1)}%`;
  if (m.format === "tons") return Math.round(v).toLocaleString("pt-BR");
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function dimLabel(id: string): string {
  return ALL_DIMENSIONS.find((d) => d.id === id)?.label ?? id;
}

// ---------------------------------------------------------------------------
// Renderizadores por tipo de bloco
// ---------------------------------------------------------------------------

function renderTitle(slide: PptxGenJS.Slide, b: TitleBlock) {
  const box = BOX(b);
  slide.addText(b.text || "", {
    ...box,
    fontFace: "Calibri",
    fontSize: Math.max(8, Math.round(b.size * 0.75)), // px → pt aprox
    bold: b.bold,
    color: b.color,
    align: b.align,
    valign: "middle",
    margin: 0,
    wrap: true,
    fit: "shrink",
  });
}

function renderText(slide: PptxGenJS.Slide, b: TextBlock) {
  const box = BOX(b);
  slide.addText(b.text || "", {
    ...box,
    fontFace: "Calibri",
    fontSize: Math.max(8, Math.round(b.size * 0.75)),
    color: b.color,
    align: b.align,
    valign: "top",
    margin: 0,
    wrap: true,
  });
}

function renderKpi(slide: PptxGenJS.Slide, b: KpiBlock, pricing: ReturnType<typeof usePricing.getState>["rows"]) {
  const box = BOX(b);
  const value = computeKpiBlock(pricing, b);
  const measureLabel = b.source === "dynamic"
    ? KPI_MEASURES.find((m) => m.id === b.measure)?.label ?? ""
    : "";

  // fundo
  slide.addShape("roundRect", {
    ...box,
    fill: { color: "F8FAFC" },
    line: { color: "E2E8F0", width: 0.75 },
    rectRadius: 0.08,
  });
  // label
  slide.addText(b.label || measureLabel || "KPI", {
    x: box.x + 0.1, y: box.y + 0.08, w: box.w - 0.2, h: 0.25,
    fontFace: "Calibri", fontSize: 9, color: "64748B", bold: false,
    margin: 0, charSpacing: 1,
  });
  // valor
  slide.addText(value, {
    x: box.x + 0.1, y: box.y + 0.32, w: box.w - 0.2, h: box.h - 0.5,
    fontFace: "Calibri",
    fontSize: Math.max(14, Math.round(b.valueSize * 0.75)),
    bold: true, color: b.color, valign: "middle", margin: 0, fit: "shrink",
  });
  // sublabel
  if (b.source === "dynamic" && measureLabel) {
    slide.addText(measureLabel, {
      x: box.x + 0.1, y: box.y + box.h - 0.22, w: box.w - 0.2, h: 0.18,
      fontFace: "Calibri", fontSize: 8, color: "94A3B8", margin: 0,
    });
  }
}

function renderShape(slide: PptxGenJS.Slide, b: ShapeBlock) {
  const box = BOX(b);
  if (b.shape === "line") {
    slide.addShape("line", {
      x: box.x, y: box.y + box.h / 2, w: box.w, h: 0,
      line: { color: b.fill, width: Math.max(1, b.h * 0.4) },
    });
    return;
  }
  slide.addShape("roundRect", {
    ...box,
    fill: { color: b.fill },
    line: { color: b.fill, width: 0 },
    rectRadius: Math.min(0.5, b.radius * SX),
  });
}

function renderImage(slide: PptxGenJS.Slide, b: ImageBlock) {
  if (!b.src) return;
  const box = BOX(b);
  slide.addImage({
    data: b.src.startsWith("data:") ? b.src : undefined,
    path: b.src.startsWith("data:") ? undefined : b.src,
    ...box,
    sizing: { type: b.fit === "cover" ? "cover" : "contain", w: box.w, h: box.h },
  });
}

function renderTable(slide: PptxGenJS.Slide, b: TableBlock,
  pricing: ReturnType<typeof usePricing.getState>["rows"],
  budget: ReturnType<typeof useBudget.getState>["rows"],
) {
  const box = BOX(b);
  const measures = TABLE_MEASURES.filter((m) => b.measures.includes(m.id));
  if (measures.length === 0) {
    slide.addText("Configure dimensões e medidas da tabela", {
      ...box, fontFace: "Calibri", fontSize: 10, color: "64748B",
      align: "center", valign: "middle", italic: true,
    });
    return;
  }
  const unified = buildUnifiedRows(pricing, budget, "real");
  const cfg: PivotConfig = {
    rows: b.rowDims,
    cols: b.colDim ? [b.colDim] : [],
    values: measures,
    filters: Object.fromEntries(Object.entries(b.filters).map(([k, v]) => [k, new Set(v ?? [])])),
  };
  const result = computePivot(unified as unknown as Record<string, unknown>[], cfg);
  if (result.rowHeaders.length === 0) return;

  const cols = result.colHeaders;
  const showCols = cols.length > 0 && cols[0].values.length > 0;

  const headerCells: PptxGenJS.TableCell[] = [{
    text: b.rowDims.map(dimLabel).join(" / ") || "Total",
    options: { bold: true, color: "FFFFFF", fill: { color: "C8102E" }, align: "center", valign: "middle" },
  }];
  if (showCols) {
    cols.forEach((c) => measures.forEach((m) => headerCells.push({
      text: `${c.values.join(" / ")} · ${m.label}`,
      options: { bold: true, color: "FFFFFF", fill: { color: "C8102E" }, align: "center", valign: "middle" },
    })));
  } else {
    measures.forEach((m) => headerCells.push({
      text: m.label,
      options: { bold: true, color: "FFFFFF", fill: { color: "C8102E" }, align: "center", valign: "middle" },
    }));
  }

  const bodyRows: PptxGenJS.TableRow[] = result.rowHeaders.map((rh) => {
    const cells: PptxGenJS.TableCell[] = [{
      text: rh.values.join(" / ") || "Total",
      options: { bold: true, color: "1C2430", align: "left", valign: "middle" },
    }];
    if (showCols) {
      cols.forEach((c) => measures.forEach((m) => {
        const v = result.cells.get(rh.key)?.get(c.key)?.[m.id] ?? 0;
        cells.push({ text: fmtMeasure(m, v), options: { color: "1C2430", align: "right", valign: "middle" } });
      }));
    } else {
      measures.forEach((m) => {
        const v = result.rowTotals.get(rh.key)?.[m.id] ?? 0;
        cells.push({ text: fmtMeasure(m, v), options: { color: "1C2430", align: "right", valign: "middle" } });
      });
    }
    return cells;
  });

  slide.addTable([headerCells, ...bodyRows], {
    ...box,
    fontFace: "Calibri", fontSize: 9,
    border: { type: "solid", pt: 0.5, color: "E2E8F0" },
    margin: 0.04,
    autoPage: false,
  });
}

function renderTopSku(slide: PptxGenJS.Slide, b: TopSkuBlock,
  pricing: ReturnType<typeof usePricing.getState>["rows"],
) {
  const box = BOX(b);
  const items = computeTopRanking(pricing, b.filters, b.dim, b.measure, b.topN, b.periodMode, b.periodValue);
  const fmt = (v: number) => formatValue(v, inferFormat(b.measure), b.measure);

  let y = box.y;
  if (b.title) {
    slide.addText(b.title, {
      x: box.x, y, w: box.w, h: 0.28,
      fontFace: "Calibri", fontSize: 13, bold: true, color: "C8102E", margin: 0,
    });
    y += 0.3;
  }

  const header: PptxGenJS.TableCell[] = [
    { text: "#", options: { bold: true, color: "FFFFFF", fill: { color: "C8102E" }, align: "center" } },
    { text: "Item", options: { bold: true, color: "FFFFFF", fill: { color: "C8102E" }, align: "left" } },
    { text: "Valor", options: { bold: true, color: "FFFFFF", fill: { color: "C8102E" }, align: "right" } },
  ];
  if (b.showShare) header.push({ text: "%", options: { bold: true, color: "FFFFFF", fill: { color: "C8102E" }, align: "right" } });

  const rows: PptxGenJS.TableRow[] = items.map((it, i) => {
    const r: PptxGenJS.TableCell[] = [
      { text: String(i + 1), options: { color: "64748B", bold: true, align: "center" } },
      { text: it.name, options: { color: "1C2430", align: "left" } },
      { text: fmt(it.value), options: { color: "1C2430", bold: true, align: "right" } },
    ];
    if (b.showShare) r.push({ text: `${(it.share * 100).toFixed(1)}%`, options: { color: "64748B", align: "right" } });
    return r;
  });

  slide.addTable([header, ...rows], {
    x: box.x, y, w: box.w, h: box.h - (y - box.y),
    fontFace: "Calibri", fontSize: 9,
    border: { type: "solid", pt: 0.5, color: "E2E8F0" },
    colW: b.showShare ? [0.4, box.w - 2.0, 1.0, 0.6] : [0.4, box.w - 1.4, 1.0],
    margin: 0.04,
    autoPage: false,
  });
}

function renderChart(slide: PptxGenJS.Slide, b: ChartBlock,
  pricing: ReturnType<typeof usePricing.getState>["rows"],
) {
  const box = BOX(b);
  const data = computeChartSeries(pricing, b.filters, b.measure, b.breakdown);
  if (data.periodos.length === 0 || data.series.length === 0) {
    slide.addText("Sem dados para os filtros escolhidos", {
      ...box, fontFace: "Calibri", fontSize: 10, color: "64748B",
      align: "center", valign: "middle", italic: true,
    });
    return;
  }

  const labels = data.periodos.map((p) => p.label);
  const chartData = data.series.map((s) => ({ name: s.name, labels, values: s.values }));

  let y = box.y, h = box.h;
  if (b.title) {
    slide.addText(b.title, {
      x: box.x, y, w: box.w, h: 0.3,
      fontFace: "Calibri", fontSize: 14, bold: true, color: "C8102E", margin: 0,
    });
    y += 0.32; h -= 0.32;
  }

  const palette = ["C8102E", "1C2430", "0F766E", "7C3AED", "EA580C", "2563EB", "0EA5E9", "16A34A"];
  slide.addChart(b.chartType === "bar" ? "bar" : "line", chartData, {
    x: box.x, y, w: box.w, h,
    chartColors: palette,
    showLegend: b.showLegend,
    legendPos: "b",
    showValue: b.showLabels,
    catAxisLabelFontFace: "Calibri",
    catAxisLabelFontSize: 9,
    valAxisLabelFontFace: "Calibri",
    valAxisLabelFontSize: 9,
    valGridLine: b.showGrid ? { color: "E2E8F0", size: 0.5 } : { style: "none" },
    catGridLine: { style: "none" },
    showTitle: false,
    lineDataSymbol: "circle",
    lineDataSymbolSize: 6,
  });
}

function renderBridge(slide: PptxGenJS.Slide, b: BridgeBlock,
  pricing: ReturnType<typeof usePricing.getState>["rows"],
  metric: ReturnType<typeof usePricing.getState>["metric"],
) {
  const box = BOX(b);
  if (!b.base || !b.comp || b.base === b.comp) {
    slide.addText("Configure base e comparação para a Bridge", {
      ...box, fontFace: "Calibri", fontSize: 10, color: "64748B",
      align: "center", valign: "middle", italic: true,
    });
    return;
  }
  const filtered = applyFilters(pricing, b.filters, null);
  const labels = b.mode === "month" ? {
    base: (() => { const r = filtered.find((x) => x.periodo === b.base); return r ? monthLabel(r.mes, r.ano) : b.base!; })(),
    comp: (() => { const r = filtered.find((x) => x.periodo === b.comp); return r ? monthLabel(r.mes, r.ano) : b.comp!; })(),
  } : undefined;

  let pvm;
  try { pvm = calcPVM(filtered, metric, b.base, b.comp, b.mode, labels); }
  catch {
    slide.addText("Não foi possível calcular a Bridge", {
      ...box, fontFace: "Calibri", fontSize: 10, color: "64748B",
      align: "center", valign: "middle", italic: true,
    });
    return;
  }

  // Bar chart simples: base, efeitos, atual. Editável no PowerPoint.
  const labelsArr = [
    pvm.baseLabel, "Volume", "Preço", "Custo", "Frete", "Comissão", "Outros", pvm.currentLabel,
  ];
  const values = [pvm.base, pvm.volume, pvm.price, pvm.cost, pvm.freight, pvm.commission, pvm.others, pvm.current];

  slide.addChart("bar", [{ name: "PVM", labels: labelsArr, values }], {
    ...box,
    barDir: "col",
    chartColors: ["C8102E"],
    showLegend: false,
    showValue: true,
    dataLabelFontFace: "Calibri",
    dataLabelFontSize: 8,
    catAxisLabelFontFace: "Calibri",
    catAxisLabelFontSize: 9,
    valAxisLabelFontFace: "Calibri",
    valAxisLabelFontSize: 8,
    valGridLine: { color: "E2E8F0", size: 0.5 },
    showTitle: false,
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function fetchAsDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function addCustomSlide(
  pptx: PptxGenJS,
  config: CustomSlideConfig,
  _opts?: { slideId?: string },
) {
  const slide = pptx.addSlide();
  slide.background = { color: config.background };

  const pricing = usePricing.getState().rows;
  const metric = usePricing.getState().metric;
  const budget = useBudget.getState().rows;

  // Renderiza por z-index
  const sorted = [...config.blocks].sort((a, b) => a.z - b.z);
  for (const blk of sorted) {
    try {
      switch (blk.kind) {
        case "title":  renderTitle(slide, blk); break;
        case "text":   renderText(slide, blk); break;
        case "kpi":    renderKpi(slide, blk, pricing); break;
        case "shape":  renderShape(slide, blk); break;
        case "image":  renderImage(slide, blk); break;
        case "table":  renderTable(slide, blk, pricing, budget); break;
        case "topSku": renderTopSku(slide, blk, pricing); break;
        case "chart":  renderChart(slide, blk, pricing); break;
        case "bridge": renderBridge(slide, blk, pricing, metric); break;
      }
    } catch (err) {
      console.error("[customSlide export] erro no bloco", blk.kind, err);
    }
  }

  if (config.showHaraldFooter) {
    const footerData = await fetchAsDataUrl(haraldFooterPng);
    slide.addImage({
      data: footerData,
      x: 0, y: SLIDE_H_IN - FOOTER_H_IN,
      w: SLIDE_W_IN, h: FOOTER_H_IN,
    });
  }
}
