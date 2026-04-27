import PptxGenJS from "pptxgenjs";
import type { PVMResult, PVMSkuDetail } from "./analytics";
import type { PricingRow } from "./types";
import { monthLabel } from "./format";
import haraldFooterPng from "@/assets/harald-footer.png";

// ---------------------------------------------------------------------------
// Paleta inspirada no slide "OVERVIEW DRE & BRIDGE" da Harald
// ---------------------------------------------------------------------------
const PPT_COLORS = {
  ink: "1C2430",
  muted: "667085",
  line: "D0D5DD",
  surface: "F8FAFC",
  surfaceAlt: "EEF2F6",
  positive: "16A34A",
  negative: "DC2626",
  base: "1D4ED8",
  // Harald deck
  haraldRed: "C8102E",
  haraldRedDark: "8B0A1E",
  // Tabela DRE — heatmap
  heatGreenStrong: "63BE7B",
  heatGreen: "A6D89A",
  heatYellow: "F8E78D",
  heatOrange: "F0A874",
  heatRedStrong: "F8696B",
  // Cores efeitos (slides de detalhe)
  volume: "0F766E",
  price: "7C3AED",
  cost: "EA580C",
  freight: "2563EB",
  commission: "C2410C",
  others: "6B7280",
};

type EffectKey = keyof Pick<PVMSkuDetail, "volumeEffect" | "priceEffect" | "costEffect">;

const EFFECT_CONFIG: Array<{ key: EffectKey; label: string; color: string }> = [
  { key: "volumeEffect", label: "Efeito Volume", color: PPT_COLORS.volume },
  { key: "priceEffect", label: "Efeito Preço", color: PPT_COLORS.price },
  { key: "costEffect", label: "Efeito Custo Variável", color: PPT_COLORS.cost },
];

// ---------------------------------------------------------------------------
// Formatação numérica fiel ao slide da Harald (sem "R$", milhar com ponto,
// negativos com sinal, "0" quando nulo)
// ---------------------------------------------------------------------------
const fmtIntBR = (v: number) => {
  if (!isFinite(v) || v === 0) return "0";
  return Math.round(v).toLocaleString("pt-BR");
};

const fmtSignedIntBR = (v: number) => {
  if (!isFinite(v) || Math.round(v) === 0) return "0";
  const r = Math.round(v);
  return r < 0
    ? `-${Math.abs(r).toLocaleString("pt-BR")}`
    : r.toLocaleString("pt-BR");
};

const fmtDecimalBR = (v: number, digits = 2) => {
  if (!isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

const fmtPctBR = (v: number, digits = 1) => {
  if (!isFinite(v)) return "—";
  return `${(v * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const brlCompact = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `R$ ${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return brl(value);
};

function safeName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function getEffectRankings(details: PVMSkuDetail[], effectKey: EffectKey) {
  const heroes = [...details]
    .filter((item) => item[effectKey] > 0)
    .sort((a, b) => b[effectKey] - a[effectKey])
    .slice(0, 5);

  const offenders = [...details]
    .filter((item) => item[effectKey] < 0)
    .sort((a, b) => a[effectKey] - b[effectKey])
    .slice(0, 5);

  return { heroes, offenders };
}

// ---------------------------------------------------------------------------
// Heatmap por linha (vermelho → amarelo → verde) usado na DRE da Harald.
// Para linhas "negativas" (custos, frete, etc.) o sinal é invertido para
// que valores menores em módulo (menos custo) fiquem verdes.
// ---------------------------------------------------------------------------
function lerpColor(hexA: string, hexB: string, t: number) {
  const a = [parseInt(hexA.slice(0, 2), 16), parseInt(hexA.slice(2, 4), 16), parseInt(hexA.slice(4, 6), 16)];
  const b = [parseInt(hexB.slice(0, 2), 16), parseInt(hexB.slice(2, 4), 16), parseInt(hexB.slice(4, 6), 16)];
  const c = a.map((av, i) => Math.round(av + (b[i] - av) * t));
  return c.map((x) => x.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function heatColor(value: number, min: number, max: number, invert = false): string {
  if (!isFinite(value) || max === min) return "FFFFFF";
  let t = (value - min) / (max - min); // 0..1
  if (invert) t = 1 - t;
  t = Math.max(0, Math.min(1, t));
  // Gradiente: vermelho (0) → laranja (.25) → amarelo (.5) → verde claro (.75) → verde forte (1)
  const stops = [
    PPT_COLORS.heatRedStrong,
    PPT_COLORS.heatOrange,
    PPT_COLORS.heatYellow,
    PPT_COLORS.heatGreen,
    PPT_COLORS.heatGreenStrong,
  ];
  const seg = t * (stops.length - 1);
  const i = Math.floor(seg);
  const f = seg - i;
  if (i >= stops.length - 1) return stops[stops.length - 1];
  return lerpColor(stops[i], stops[i + 1], f);
}

// ---------------------------------------------------------------------------
// Agrega métricas mensais para a tabela DRE do slide Overview
// ---------------------------------------------------------------------------
interface DreMonth {
  periodo: string;
  mes: number;
  ano: number;
  label: string;
  volumeKg: number;
  rol: number;
  custoVariavel: number;
  materiaPrima: number;
  somaCif: number;
  embalagem: number;
  freteSobreVendas: number;
  comissaoRepres: number;
  contribMarginal: number;
}

function aggregateDreByMonth(rows: PricingRow[]): DreMonth[] {
  const map = new Map<string, DreMonth>();
  for (const r of rows) {
    const cur = map.get(r.periodo) ?? {
      periodo: r.periodo,
      mes: r.mes,
      ano: r.ano,
      label: monthLabel(r.mes, r.ano).toLowerCase(),
      volumeKg: 0,
      rol: 0,
      custoVariavel: 0,
      materiaPrima: 0,
      somaCif: 0,
      embalagem: 0,
      freteSobreVendas: 0,
      comissaoRepres: 0,
      contribMarginal: 0,
    };
    cur.volumeKg += r.volumeKg;
    cur.rol += r.rol;
    cur.custoVariavel += r.custoVariavel ?? 0;
    cur.materiaPrima += r.materiaPrima ?? 0;
    cur.embalagem += r.embalagem ?? 0;
    // "Soma de CIF" do deck Harald = custo fixo/CIF agregado
    cur.somaCif += r.cif ?? 0;
    cur.freteSobreVendas += r.frete ?? 0;
    cur.comissaoRepres += r.comissao ?? 0;
    cur.contribMarginal += r.contribMarginal;
    map.set(r.periodo, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.ano - b.ano || a.mes - b.mes);
}

// ---------------------------------------------------------------------------
// SLIDE 1 — Overview DRE & Bridge (estilo Harald)
// Layout fiel ao PNG de referência:
//   • Título em vermelho no topo
//   • Selo "DRE" rotacionado à esquerda + tabela DRE mensal com heatmap
//   • Selo "BRIDGE" rotacionado à esquerda + waterfall minimalista
//     (totais como retângulos pretos, deltas como linha curta vermelha)
//   • Rodapé arco vermelho + logo Harald (imagem)
// ---------------------------------------------------------------------------
function addOverviewDreBridgeSlide(
  pptx: PptxGenJS,
  result: PVMResult,
  rows: PricingRow[],
) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  // ---- Título ---------------------------------------------------------
  slide.addText("OVERVIEW DRE & BRIDGE", {
    x: 0.4,
    y: 0.25,
    w: 9,
    h: 0.55,
    fontFace: "Arial",
    fontSize: 28,
    bold: true,
    color: PPT_COLORS.haraldRed,
    margin: 0,
  });

  // ---- Rodapé: arco vermelho + logo Harald (imagem importada) ---------
  slide.addImage({
    data: haraldFooterPng,
    x: 0,
    y: 6.95,
    w: 13.33,
    h: 0.6,
    sizing: { type: "cover", w: 13.33, h: 0.6 },
  });

  // ---- "DRE" lateral --------------------------------------------------
  slide.addText("DRE", {
    x: -0.15,
    y: 1.5,
    w: 1.0,
    h: 0.4,
    fontFace: "Arial",
    fontSize: 18,
    bold: true,
    color: PPT_COLORS.haraldRed,
    rotate: 270,
    align: "center",
    valign: "middle",
    margin: 0,
  });

  // ---- "BRIDGE" lateral ----------------------------------------------
  slide.addText("BRIDGE", {
    x: -0.25,
    y: 4.55,
    w: 1.2,
    h: 0.4,
    fontFace: "Arial",
    fontSize: 18,
    bold: true,
    color: PPT_COLORS.haraldRed,
    rotate: 270,
    align: "center",
    valign: "middle",
    margin: 0,
  });

  // ---- Tabela DRE mensal ---------------------------------------------
  const allMonths = aggregateDreByMonth(rows);
  // Limita a últimos 10 meses para caber bem no slide
  const months = allMonths.slice(-10);

  const tableX = 0.85;
  const tableY = 0.95;
  const tableW = 12.1;
  const labelColW = 2.05;
  const dataW = tableW - labelColW;
  const colCount = months.length || 1;
  const colW = dataW / colCount;

  // Linhas com extrator de valor + tipo (positivo=verde alto / inverso=verde baixo)
  type Line = {
    label: string;
    get: (m: DreMonth) => number;
    fmt: (v: number) => string;
    invert?: boolean; // true para custos (menor é melhor)
    bold?: boolean;
    boxed?: boolean; // borda destacada (vermelha) como no deck
    boxColor?: string;
    noHeat?: boolean;
  };

  const lines: Line[] = [
    { label: "Volume (Tons)", get: (m) => m.volumeKg / 1000, fmt: (v) => fmtDecimalBR(v, 0).replace(/\./g, ".").replace(/,00$/, ""), boxed: true, boxColor: PPT_COLORS.haraldRed, noHeat: true },
    { label: "Receita Operacional Líquida", get: (m) => m.rol / 1000, fmt: (v) => fmtIntBR(v), noHeat: true },
    { label: "ROL (R$/Kg)", get: (m) => (m.volumeKg > 0 ? m.rol / m.volumeKg : 0), fmt: (v) => fmtDecimalBR(v, 2), boxed: true, boxColor: PPT_COLORS.heatGreenStrong },
    { label: "Custo Variável", get: (m) => -m.custoVariavel / 1000, fmt: (v) => fmtSignedIntBR(v), invert: true, noHeat: true },
    { label: "Custo Variável (R$/Kg)", get: (m) => (m.volumeKg > 0 ? -m.custoVariavel / m.volumeKg : 0), fmt: (v) => fmtDecimalBR(v, 2), invert: true },
    { label: "Matéria Prima", get: (m) => -m.materiaPrima / 1000, fmt: (v) => fmtSignedIntBR(v), invert: true, noHeat: true },
    { label: "Soma de CIF", get: (m) => m.somaCif / 1000, fmt: (v) => fmtIntBR(v), noHeat: true },
    { label: "Embalagem", get: (m) => -m.embalagem / 1000, fmt: (v) => fmtSignedIntBR(v), invert: true, noHeat: true },
    { label: "Frete sobre Vendas", get: (m) => -m.freteSobreVendas / 1000, fmt: (v) => fmtSignedIntBR(v), invert: true, noHeat: true },
    { label: "Frete (R$/Kg)", get: (m) => (m.volumeKg > 0 ? -m.freteSobreVendas / m.volumeKg : 0), fmt: (v) => fmtDecimalBR(v, 2), invert: true },
    { label: "Comissão Repres", get: (m) => -m.comissaoRepres / 1000, fmt: (v) => fmtSignedIntBR(v), invert: true, noHeat: true },
    { label: "Comissão (%/ROL)", get: (m) => (m.rol > 0 ? -m.comissaoRepres / m.rol : 0), fmt: (v) => fmtPctBR(v, 1), invert: true },
    { label: "Comissão (R$/Kg)", get: (m) => (m.volumeKg > 0 ? -m.comissaoRepres / m.volumeKg : 0), fmt: (v) => fmtDecimalBR(v, 2), invert: true },
    { label: "Contrib. Marginal", get: (m) => m.contribMarginal / 1000, fmt: (v) => fmtIntBR(v), bold: true, boxed: true, boxColor: PPT_COLORS.haraldRed, noHeat: true },
    { label: "Contrib. Marginal (%/ROL)", get: (m) => (m.rol > 0 ? m.contribMarginal / m.rol : 0), fmt: (v) => fmtPctBR(v, 1), noHeat: true },
    { label: "Contrib. Marginal (R$/Kg)", get: (m) => (m.volumeKg > 0 ? m.contribMarginal / m.volumeKg : 0), fmt: (v) => fmtDecimalBR(v, 2) },
  ];

  type Cell = { text: string; options: PptxGenJS.TableCellProps };

  // Cabeçalho mensal
  const header: Cell[] = [
    {
      text: "Valores",
      options: {
        bold: true,
        color: "FFFFFF",
        fill: { color: PPT_COLORS.haraldRed },
        align: "center",
        valign: "middle",
        fontSize: 8,
      },
    },
    ...months.map((m) => ({
      text: m.label,
      options: {
        bold: true,
        color: "FFFFFF",
        fill: { color: PPT_COLORS.haraldRed },
        align: "center" as const,
        valign: "middle" as const,
        fontSize: 8,
      },
    })),
  ];

  const rowsTbl: Cell[][] = [header];

  lines.forEach((ln) => {
    const values = months.map(ln.get);
    const valid = values.filter((v) => isFinite(v));
    const min = valid.length ? Math.min(...valid) : 0;
    const max = valid.length ? Math.max(...valid) : 0;

    const cells: Cell[] = [
      {
        text: ln.label,
        options: {
          bold: ln.bold,
          color: PPT_COLORS.ink,
          fill: { color: "FFFFFF" },
          align: "left",
          valign: "middle",
          fontSize: 8,
          margin: 0.04,
        },
      },
      ...values.map((v) => {
        const fill = ln.noHeat ? "FFFFFF" : heatColor(v, min, max, ln.invert);
        return {
          text: ln.fmt(v),
          options: {
            bold: ln.bold,
            color: PPT_COLORS.ink,
            fill: { color: fill },
            align: "center" as const,
            valign: "middle" as const,
            fontSize: 8,
            margin: 0.02,
          },
        };
      }),
    ];
    rowsTbl.push(cells);
  });

  const headerH = 0.24;
  const rowH = 0.21; // altura fixa por linha (16 linhas × 0.21 ≈ 3.36")

  slide.addTable(rowsTbl, {
    x: tableX,
    y: tableY,
    w: tableW,
    colW: [labelColW, ...Array(colCount).fill(colW)],
    rowH: [headerH, ...Array(lines.length).fill(rowH)],
    border: { pt: 0.5, color: "FFFFFF" },
    fontFace: "Arial",
    fontSize: 8,
    valign: "middle",
    autoPage: false,
  });

  // Bordas vermelhas/verdes externas em linhas-chave (Volume / ROL R$Kg /
  // Contrib. Marginal) — retângulos vazios desenhados sobre a tabela.
  const drawBox = (rowIdx0: number, color: string) => {
    const y = tableY + headerH + rowH * rowIdx0;
    slide.addShape("rect", {
      x: tableX + labelColW - 0.02,
      y: y - 0.005,
      w: dataW + 0.04,
      h: rowH + 0.01,
      fill: { type: "none" },
      line: { color, width: 1.25 },
    });
  };
  // Volume = linha 0; ROL R$/Kg = linha 2; Contrib Marginal = linha 13
  drawBox(0, PPT_COLORS.haraldRed);
  drawBox(2, PPT_COLORS.heatGreenStrong);
  drawBox(13, PPT_COLORS.haraldRed);

  // ---- BRIDGE minimalista ---------------------------------------------
  // Replica o estilo do PNG: totais como retângulos pretos cheios,
  // deltas como linha horizontal curta vermelha posicionada no topo
  // do "patamar" do delta. Valor numérico acima.
  type Step = { label: string; value: number; type: "total" | "delta" };
  // Ordem do deck Harald: PP / Volume / Frete / Comissão / Outros / Preço / Custo / Total
  const steps: Step[] = [
    { label: "Contrib. Marginal PP", value: result.base, type: "total" },
    { label: "Efeito volume", value: result.volume, type: "delta" },
    { label: "Efeito frete", value: result.freight, type: "delta" },
    { label: "Efeito comissão", value: result.commission, type: "delta" },
    { label: "Efeito outros", value: result.others, type: "delta" },
    { label: "Efeito preço", value: result.price, type: "delta" },
    { label: "Efeito custo variável", value: result.cost, type: "delta" },
    { label: "Contrib. Marginal total", value: result.current, type: "total" },
  ];

  // Geometria start/end (mesmo princípio do componente Waterfall)
  const geom: { start: number; end: number; value: number; type: "total" | "delta" }[] = [];
  let running = 0;
  steps.forEach((s) => {
    if (s.type === "total") {
      geom.push({ start: 0, end: s.value, value: s.value, type: "total" });
      running = s.value;
    } else {
      const end = running + s.value;
      geom.push({ start: running, end, value: s.value, type: "delta" });
      running = end;
    }
  });

  // Range incluindo o zero
  const allVals = geom.flatMap((g) => [g.start, g.end, 0]);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 1;
  const yMin = minV - range * 0.08;
  const yMax = maxV + range * 0.18; // espaço extra para labels acima

  // Plot area
  const plotX = 0.95;
  const plotY = 4.55;
  const plotW = 12.0;
  const plotH = 1.95; // bar area (sem labels de eixo)
  const labelStripY = plotY + plotH + 0.05;
  const labelStripH = 0.3;

  const colSlot = plotW / steps.length;
  const barW = colSlot * 0.42;

  // Mapeia valor → y dentro do plot (origem em cima)
  const yOf = (v: number) => plotY + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  geom.forEach((g, i) => {
    const s = steps[i];
    const cx = plotX + colSlot * i + colSlot / 2;
    const xBar = cx - barW / 2;

    if (s.type === "total") {
      // Retângulo preto cheio, do zero (ou do topo até zero) ao valor
      const yTop = yOf(Math.max(0, g.value));
      const yBot = yOf(Math.min(0, g.value));
      slide.addShape("rect", {
        x: xBar,
        y: yTop,
        w: barW,
        h: Math.max(0.04, yBot - yTop),
        fill: { color: "000000" },
        line: { color: "000000", width: 0 },
        objectName: `bridge_bar_${i}`,
      });
    } else {
      // Linha vermelha curta no topo do "patamar" do delta
      const hi = Math.max(g.start, g.end);
      const y = yOf(hi);
      slide.addShape("rect", {
        x: xBar,
        y: y - 0.025,
        w: barW,
        h: 0.05,
        fill: { color: PPT_COLORS.haraldRed },
        line: { color: PPT_COLORS.haraldRed, width: 0 },
        objectName: `bridge_bar_${i}`,
      });
    }

    // Label numérico acima do topo da barra/linha — milhares com 1 casa decimal
    const valShown = s.value / 1000; // milhares
    const valText = s.type === "total"
      ? fmtDecimalBR(valShown, 1)
      : fmtDecimalBR(Math.abs(valShown), 1);
    const topY = s.type === "total" ? yOf(Math.max(0, g.value)) : yOf(Math.max(g.start, g.end));
    slide.addText(valText, {
      x: cx - colSlot / 2,
      y: Math.max(plotY - 0.05, topY - 0.32),
      w: colSlot,
      h: 0.28,
      fontFace: "Arial",
      fontSize: 11,
      color: PPT_COLORS.ink,
      align: "center",
      valign: "bottom",
      margin: 0,
      objectName: `bridge_value_${i}`,
    });

    // Label da categoria (abaixo do plot)
    slide.addText(s.label, {
      x: cx - colSlot / 2,
      y: labelStripY,
      w: colSlot,
      h: labelStripH,
      fontFace: "Arial",
      fontSize: 9,
      color: PPT_COLORS.muted,
      align: "center",
      valign: "top",
      margin: 0,
      objectName: `bridge_label_${i}`,
    });
  });
}

// ---------------------------------------------------------------------------
// SLIDE 2 — Tabela "Resumo editável" (mantida do export anterior)
// ---------------------------------------------------------------------------
function addBridgeTableSlide(pptx: PptxGenJS, result: PVMResult) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  slide.addText("Bridge PVM — Resumo editável", {
    x: 0.6,
    y: 0.45,
    w: 9,
    h: 0.4,
    fontFace: "Aptos Display",
    fontSize: 22,
    bold: true,
    color: PPT_COLORS.ink,
    margin: 0,
  });
  slide.addText(`${result.baseLabel} → ${result.currentLabel}`, {
    x: 0.6,
    y: 0.9,
    w: 6,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 11,
    color: PPT_COLORS.muted,
    margin: 0,
  });

  const tableRows: PptxGenJS.TableRow[] = [
    [
      { text: "Linha", options: { bold: true, color: "FFFFFF", fill: { color: PPT_COLORS.ink }, align: "center" } },
      { text: "Valor", options: { bold: true, color: "FFFFFF", fill: { color: PPT_COLORS.ink }, align: "center" } },
    ],
    [
      { text: `Margem base (${result.baseLabel})` },
      { text: brl(result.base), options: { align: "right" } },
    ],
    [{ text: "Efeito Volume" }, { text: brl(result.volume), options: { align: "right" } }],
    [{ text: "Efeito Preço" }, { text: brl(result.price), options: { align: "right" } }],
    [{ text: "Efeito Custo Variável" }, { text: brl(result.cost), options: { align: "right" } }],
    [{ text: "Efeito Frete" }, { text: brl(result.freight), options: { align: "right" } }],
    [{ text: "Efeito Comissão" }, { text: brl(result.commission), options: { align: "right" } }],
    [{ text: "Efeito Outros" }, { text: brl(result.others), options: { align: "right" } }],
    [
      { text: `Margem atual (${result.currentLabel})`, options: { bold: true, fill: { color: PPT_COLORS.surfaceAlt } } },
      { text: brl(result.current), options: { bold: true, align: "right", fill: { color: PPT_COLORS.surfaceAlt } } },
    ],
  ];

  slide.addTable(tableRows, {
    x: 2.5,
    y: 1.5,
    w: 5,
    h: 4.8,
    colW: [3, 2],
    border: { pt: 1, color: PPT_COLORS.line },
    margin: 0.08,
    fontFace: "Aptos",
    fontSize: 11,
    color: PPT_COLORS.ink,
    fill: { color: PPT_COLORS.surface },
    valign: "middle",
  });
}

// ---------------------------------------------------------------------------
// SLIDES 3+ — Heróis e Ofensores por efeito (mantidos do export anterior)
// ---------------------------------------------------------------------------
function addEffectSlide(pptx: PptxGenJS, result: PVMResult, effect: { key: EffectKey; label: string; color: string }) {
  const slide = pptx.addSlide();
  slide.background = { color: "FFFFFF" };

  const { heroes, offenders } = getEffectRankings(result.skuDetails, effect.key);
  const chartItems = [...heroes, ...offenders]
    .sort((a, b) => b[effect.key] - a[effect.key])
    .slice(0, 10);

  slide.addText(effect.label, {
    x: 0.6,
    y: 0.45,
    w: 5,
    h: 0.35,
    fontFace: "Aptos Display",
    fontSize: 22,
    bold: true,
    color: PPT_COLORS.ink,
    margin: 0,
  });
  slide.addText("Top 5 heróis e ofensores por SKU", {
    x: 0.6,
    y: 0.86,
    w: 4,
    h: 0.25,
    fontFace: "Aptos",
    fontSize: 10,
    color: PPT_COLORS.muted,
    margin: 0,
  });

  slide.addChart(
    "bar",
    [
      {
        name: effect.label,
        labels: chartItems.map((item) => item.sku),
        values: chartItems.map((item) => item[effect.key]),
      },
    ],
    {
      x: 0.6,
      y: 1.35,
      w: 5.25,
      h: 5.25,
      chartColors: [effect.color],
      catAxisLabelFontFace: "Aptos",
      catAxisLabelFontSize: 10,
      valAxisLabelFontFace: "Aptos",
      valAxisLabelFontSize: 9,
      valGridLine: { color: "E5E7EB", size: 1 },
      showLegend: false,
      showValue: true,
      dataLabelPosition: "outEnd",
      dataLabelColor: PPT_COLORS.ink,
      showTitle: false,
      showValAxisTitle: false,
      showCatAxisTitle: false,
    },
  );

  const asTableRows = (title: string, items: PVMSkuDetail[], toneColor: string) => {
    const rows: PptxGenJS.TableRow[] = [
      [
        { text: title, options: { bold: true, color: "FFFFFF", fill: { color: toneColor } } },
        { text: "Impacto", options: { bold: true, color: "FFFFFF", fill: { color: toneColor }, align: "right" } },
      ],
    ];

    if (items.length === 0) {
      rows.push([
        { text: "Sem SKUs relevantes no recorte atual", options: { italic: true, color: PPT_COLORS.muted } },
        { text: "—", options: { align: "right", color: PPT_COLORS.muted } },
      ]);
      return rows;
    }

    items.forEach((item) => {
      rows.push([
        { text: item.sku },
        { text: brl(item[effect.key]), options: { align: "right" } },
      ]);
    });

    return rows;
  };

  slide.addTable(asTableRows("Heróis", heroes, PPT_COLORS.positive), {
    x: 6.15,
    y: 1.35,
    w: 3.2,
    h: 2.45,
    colW: [2.15, 1.05],
    border: { pt: 1, color: PPT_COLORS.line },
    margin: 0.05,
    fontFace: "Aptos",
    fontSize: 9,
    color: PPT_COLORS.ink,
    fill: { color: PPT_COLORS.surface },
    valign: "middle",
  });

  slide.addTable(asTableRows("Ofensores", offenders, PPT_COLORS.negative), {
    x: 6.15,
    y: 4.08,
    w: 3.2,
    h: 2.45,
    colW: [2.15, 1.05],
    border: { pt: 1, color: PPT_COLORS.line },
    margin: 0.05,
    fontFace: "Aptos",
    fontSize: 9,
    color: PPT_COLORS.ink,
    fill: { color: PPT_COLORS.surface },
    valign: "middle",
  });
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
export async function exportBridgePvmPpt(result: PVMResult, rows: PricingRow[] = []) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.author = "Lovable";
  pptx.company = "Lovable";
  pptx.subject = "Bridge PVM";
  pptx.title = `Bridge PVM ${result.baseLabel} vs ${result.currentLabel}`;
  pptx.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
  };

  addOverviewDreBridgeSlide(pptx, result, rows);
  addBridgeTableSlide(pptx, result);
  EFFECT_CONFIG.forEach((effect) => addEffectSlide(pptx, result, effect));

  await pptx.writeFile({
    fileName: `bridge_pvm_${safeName(result.baseLabel)}_vs_${safeName(result.currentLabel)}.pptx`,
    compression: true,
  });
}
