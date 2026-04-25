import PptxGenJS from "pptxgenjs";
import type { PVMResult, PVMSkuDetail } from "./analytics";

const PPT_COLORS = {
  ink: "1C2430",
  muted: "667085",
  line: "D0D5DD",
  surface: "F8FAFC",
  surfaceAlt: "EEF2F6",
  positive: "16A34A",
  negative: "DC2626",
  base: "1D4ED8",
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

function addCover(slide: PptxGenJS.Slide, result: PVMResult) {
  slide.background = { color: "F7F9FC" };
  slide.addText("Bridge PVM", {
    x: 0.6,
    y: 0.5,
    w: 4.5,
    h: 0.5,
    fontFace: "Aptos Display",
    fontSize: 24,
    bold: true,
    color: PPT_COLORS.ink,
    margin: 0,
  });
  slide.addText(`${result.baseLabel} → ${result.currentLabel}`, {
    x: 0.6,
    y: 1.02,
    w: 5,
    h: 0.3,
    fontFace: "Aptos",
    fontSize: 11,
    color: PPT_COLORS.muted,
    margin: 0,
  });

  const kpis = [
    { label: "Margem base", value: brlCompact(result.base), color: PPT_COLORS.base },
    { label: "Variação total", value: brlCompact(result.current - result.base), color: result.current - result.base >= 0 ? PPT_COLORS.positive : PPT_COLORS.negative },
    { label: "Margem atual", value: brlCompact(result.current), color: PPT_COLORS.base },
  ];

  kpis.forEach((item, index) => {
    const x = 0.6 + index * 3.05;
    slide.addShape("roundRect", {
      x,
      y: 1.5,
      w: 2.75,
      h: 1.05,
      rectRadius: 0.06,
      line: { color: PPT_COLORS.line, pt: 1 },
      fill: { color: "FFFFFF" },
    });
    slide.addText(item.label, {
      x: x + 0.18,
      y: 1.72,
      w: 2.3,
      h: 0.2,
      fontFace: "Aptos",
      fontSize: 9,
      color: PPT_COLORS.muted,
      margin: 0,
    });
    slide.addText(item.value, {
      x: x + 0.18,
      y: 2.0,
      w: 2.35,
      h: 0.28,
      fontFace: "Aptos",
      fontSize: 18,
      bold: true,
      color: item.color,
      margin: 0,
    });
  });
}

function addBridgeSummarySlide(pptx: PptxGenJS, result: PVMResult) {
  const slide = pptx.addSlide();
  addCover(slide, result);

  slide.addText("Impactos da bridge", {
    x: 0.6,
    y: 2.95,
    w: 4,
    h: 0.3,
    fontFace: "Aptos Display",
    fontSize: 16,
    bold: true,
    color: PPT_COLORS.ink,
    margin: 0,
  });

  // Waterfall manual com colunas empilhadas: invisível (base) + visível (delta).
  // Totais (base e atual) = barra cheia preta. Variações = verde se positivo, vermelho se negativo.
  type Step = { label: string; value: number; type: "total" | "delta" };
  const steps: Step[] = [
    { label: `Margem ${result.baseLabel}`, value: result.base, type: "total" },
    { label: "Volume", value: result.volume, type: "delta" },
    { label: "Preço", value: result.price, type: "delta" },
    { label: "Custo Var.", value: result.cost, type: "delta" },
    { label: "Frete", value: result.freight, type: "delta" },
    { label: "Comissão", value: result.commission, type: "delta" },
    { label: "Outros", value: result.others, type: "delta" },
    { label: `Margem ${result.currentLabel}`, value: result.current, type: "total" },
  ];

  // Calcula a base invisível e a porção visível para cada coluna.
  const invisible: number[] = [];
  const positives: number[] = [];
  const negatives: number[] = [];
  const totals: number[] = [];

  let running = 0;
  steps.forEach((s) => {
    if (s.type === "total") {
      invisible.push(0);
      positives.push(0);
      negatives.push(0);
      totals.push(s.value);
      running = s.value;
    } else if (s.value >= 0) {
      invisible.push(running);
      positives.push(s.value);
      negatives.push(0);
      totals.push(0);
      running += s.value;
    } else {
      const abs = Math.abs(s.value);
      invisible.push(running - abs);
      positives.push(0);
      negatives.push(abs);
      totals.push(0);
      running -= abs;
    }
  });

  const labels = steps.map((s) => s.label);
  // Rótulos: mostramos o valor real (com sinal) onde a barra é visível, vazio onde não.
  const labelFor = (i: number) => {
    const s = steps[i];
    if (s.type === "total") return brlCompact(s.value);
    return brlCompact(s.value);
  };

  slide.addChart(
    "bar",
    [
      {
        name: "_base",
        labels,
        values: invisible,
      },
      {
        name: "Aumento",
        labels,
        values: positives,
      },
      {
        name: "Redução",
        labels,
        values: negatives,
      },
      {
        name: "Total",
        labels,
        values: totals,
      },
    ],
    {
      x: 0.6,
      y: 3.35,
      w: 5.55,
      h: 3.25,
      barDir: "col",
      barGrouping: "stacked",
      catAxisLabelFontFace: "Aptos",
      catAxisLabelFontSize: 9,
      catAxisLabelRotate: -25,
      valAxisLabelFontFace: "Aptos",
      valAxisLabelFontSize: 9,
      valGridLine: { color: "E5E7EB", size: 1 },
      showLegend: false,
      showTitle: false,
      showValue: true,
      chartColors: ["FFFFFF", PPT_COLORS.positive, PPT_COLORS.negative, "000000"],
      chartColorsOpacity: 100,
      dataLabelColor: PPT_COLORS.ink,
      dataLabelPosition: "outEnd",
      dataLabelFontFace: "Aptos",
      dataLabelFontSize: 9,
      dataLabelFormatCode: '[<-1000000]"-R$ "0.0,,"M";[<0]"-R$ "0.0,"k";[>=1000000]"R$ "0.0,,"M";"R$ "0.0,"k"',
      showSerName: false,
      showValAxisTitle: false,
      showCatAxisTitle: false,
    },
  );

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

  slide.addText("Resumo editável", {
    x: 6.45,
    y: 2.95,
    w: 2.8,
    h: 0.3,
    fontFace: "Aptos Display",
    fontSize: 16,
    bold: true,
    color: PPT_COLORS.ink,
    margin: 0,
  });

  slide.addTable(tableRows, {
    x: 6.45,
    y: 3.35,
    w: 2.9,
    h: 3.15,
    colW: [1.85, 1.05],
    border: { pt: 1, color: PPT_COLORS.line },
    margin: 0.05,
    fontFace: "Aptos",
    fontSize: 9,
    color: PPT_COLORS.ink,
    fill: { color: PPT_COLORS.surface },
    valign: "middle",
  });
}

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

export async function exportBridgePvmPpt(result: PVMResult) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Lovable";
  pptx.company = "Lovable";
  pptx.subject = "Bridge PVM";
  pptx.title = `Bridge PVM ${result.baseLabel} vs ${result.currentLabel}`;
  pptx.theme = {
    headFontFace: "Aptos Display",
    bodyFontFace: "Aptos",
  };

  addBridgeSummarySlide(pptx, result);
  EFFECT_CONFIG.forEach((effect) => addEffectSlide(pptx, result, effect));

  await pptx.writeFile({
    fileName: `bridge_pvm_${safeName(result.baseLabel)}_vs_${safeName(result.currentLabel)}.pptx`,
    compression: true,
  });
}