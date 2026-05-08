// Exportador do slide "Personalizado" para PPTX.
// Estratégia: blocos simples (title/text/kpi/shape/image) viram elementos
// nativos editáveis. Blocos de dados (bridge/chart/table/topSku) são
// renderizados como PNG fiel ao canvas — capturados do DOM se disponível,
// ou montados off-screen via React no momento do export.

import type PptxGenJS from "pptxgenjs";
import React from "react";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import {
  CANVAS_W, CANVAS_H, type CustomSlideConfig, type CustomBlock,
  type TitleBlock, type TextBlock, type KpiBlock, type ImageBlock,
  type ShapeBlock, KPI_MEASURES,
} from "./customSlide";
import haraldFooterPng from "@/assets/harald-footer-bar.png";
import { usePricing } from "@/store/pricing";
import { computeKpiBlock } from "./customKpi";
import { getCustomCanvas } from "./customCanvasRegistry";
import { BlockRenderer } from "@/components/pricing/custom/BlockRenderer";

const SLIDE_W_IN = 13.33;
const SLIDE_H_IN = 7.5;
const FOOTER_H_IN = 0.85;

const SX = SLIDE_W_IN / CANVAS_W;
const SY = SLIDE_H_IN / CANVAS_H;

const BOX = (b: CustomBlock) => ({
  x: b.x * SX, y: b.y * SY, w: b.w * SX, h: b.h * SY,
});

// ---------------------------------------------------------------------------
// Renderizadores nativos (texto / KPI / forma / imagem)
// ---------------------------------------------------------------------------
function renderTitle(slide: PptxGenJS.Slide, b: TitleBlock) {
  slide.addText(b.text || "", {
    ...BOX(b),
    fontFace: "Calibri",
    fontSize: Math.max(8, Math.round(b.size * 0.75)),
    bold: b.bold, color: b.color, align: b.align,
    valign: "middle", margin: 0, wrap: true, fit: "shrink",
  });
}
function renderText(slide: PptxGenJS.Slide, b: TextBlock) {
  slide.addText(b.text || "", {
    ...BOX(b),
    fontFace: "Calibri",
    fontSize: Math.max(8, Math.round(b.size * 0.75)),
    color: b.color, align: b.align,
    valign: "top", margin: 0, wrap: true,
  });
}
function renderKpi(slide: PptxGenJS.Slide, b: KpiBlock,
  pricing: ReturnType<typeof usePricing.getState>["rows"]) {
  const box = BOX(b);
  const value = computeKpiBlock(pricing, b);
  const measureLabel = b.source === "dynamic"
    ? KPI_MEASURES.find((m) => m.id === b.measure)?.label ?? "" : "";
  slide.addShape("roundRect", {
    ...box, fill: { color: "F8FAFC" },
    line: { color: "E2E8F0", width: 0.75 }, rectRadius: 0.08,
  });
  slide.addText(b.label || measureLabel || "KPI", {
    x: box.x + 0.1, y: box.y + 0.08, w: box.w - 0.2, h: 0.25,
    fontFace: "Calibri", fontSize: 9, color: "64748B", margin: 0, charSpacing: 1,
  });
  slide.addText(value, {
    x: box.x + 0.1, y: box.y + 0.32, w: box.w - 0.2, h: box.h - 0.5,
    fontFace: "Calibri",
    fontSize: Math.max(14, Math.round(b.valueSize * 0.75)),
    bold: true, color: b.color, valign: "middle", margin: 0, fit: "shrink",
  });
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
    ...box, fill: { color: b.fill },
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

// ---------------------------------------------------------------------------
// PNG capture — DOM ao vivo OU offscreen
// ---------------------------------------------------------------------------
async function waitFonts() {
  if ((document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready) {
    await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready;
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
}

async function captureNode(node: HTMLElement): Promise<string> {
  return toPng(node, {
    pixelRatio: 2,
    backgroundColor: "#FFFFFF",
    cacheBust: true,
    filter: (n) => {
      if (!(n instanceof Element)) return true;
      const cls = n.getAttribute("class") ?? "";
      return !/react-resizable-handle|outline-primary/.test(cls);
    },
  });
}

async function renderBlockOffscreen(block: CustomBlock): Promise<string> {
  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed", "left:-99999px", "top:0",
    `width:${block.w}px`, `height:${block.h}px`,
    "background:#FFFFFF", "overflow:hidden", "z-index:-1",
  ].join(";");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    root.render(React.createElement(BlockRenderer, { block }));
    // Aguarda render + dados (Zustand é síncrono; SVGs precisam de 2 frames)
    await waitFonts();
    await new Promise((r) => setTimeout(r, 80));
    return await captureNode(host);
  } finally {
    setTimeout(() => { try { root.unmount(); } catch {} host.remove(); }, 0);
  }
}

async function renderBlockAsImage(
  slide: PptxGenJS.Slide, block: CustomBlock, slideId?: string,
) {
  const box = BOX(block);
  try {
    const canvas = slideId ? getCustomCanvas(slideId) : null;
    const liveNode = canvas?.querySelector(`[data-block-id="${block.id}"]`) as HTMLElement | null;
    await waitFonts();
    const dataUrl = liveNode
      ? await captureNode(liveNode)
      : await renderBlockOffscreen(block);
    slide.addImage({
      data: dataUrl,
      x: box.x, y: box.y, w: box.w, h: box.h,
      sizing: { type: "contain", w: box.w, h: box.h },
    });
  } catch (err) {
    console.error("[customSlide export] falha ao renderizar bloco", block.kind, err);
    slide.addText(`Falha ao renderizar (${block.kind})`, {
      ...box, fontFace: "Calibri", fontSize: 10, color: "C8102E",
      align: "center", valign: "middle", italic: true,
    });
  }
}

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
  opts?: { slideId?: string },
) {
  const slide = pptx.addSlide();
  slide.background = { color: config.background };
  const pricing = usePricing.getState().rows;

  const sorted = [...config.blocks].sort((a, b) => a.z - b.z);
  for (const blk of sorted) {
    try {
      switch (blk.kind) {
        case "title":  renderTitle(slide, blk); break;
        case "text":   renderText(slide, blk); break;
        case "kpi":    renderKpi(slide, blk, pricing); break;
        case "shape":  renderShape(slide, blk); break;
        case "image":  renderImage(slide, blk); break;
        // Blocos de dados — captura PNG fiel ao canvas
        case "table":
        case "topSku":
        case "chart":
        case "bridge":
          await renderBlockAsImage(slide, blk, opts?.slideId);
          break;
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
