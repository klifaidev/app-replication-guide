// Exportador do slide "Personalizado" para PPTX.
// Captura preferencialmente o canvas REAL já montado no editor (via registry),
// garantindo fidelidade total e SVG/Recharts/dados dos stores prontos.
// Fallback: monta um host visível em opacity:0 para slides nunca abertos.

import type PptxGenJS from "pptxgenjs";
import { createRoot, type Root } from "react-dom/client";
import { toPng } from "html-to-image";
import { CANVAS_W, CANVAS_H, type CustomSlideConfig } from "./customSlide";
import { BlockRenderer } from "@/components/pricing/custom/BlockRenderer";
import haraldFooterPng from "@/assets/harald-footer-bar.png";
import { getCustomCanvas } from "./customCanvasRegistry";

const SLIDE_W_IN = 13.33;
const SLIDE_H_IN = 7.5;
const FOOTER_H_IN = 0.85;

async function waitForReady() {
  if ("fonts" in document) {
    try { await (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready; }
    catch { /* noop */ }
  }
  // 3 frames + delay para Recharts/SVG/tabela terminarem layout
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => requestAnimationFrame(r));
  }
  await new Promise((r) => setTimeout(r, 350));
}

async function snapshotElement(el: HTMLElement): Promise<string> {
  await waitForReady();
  // Salva e neutraliza propriedades visuais que atrapalham a captura
  const prev = {
    transform: el.style.transform,
    boxShadow: el.style.boxShadow,
    outline: el.style.outline,
  };
  el.style.transform = "none";
  el.style.boxShadow = "none";
  el.style.outline = "none";
  try {
    return await toPng(el, {
      pixelRatio: 2,
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: "#FFFFFF",
      cacheBust: true,
      style: { transform: "none", transformOrigin: "top left" },
      // Evita que filhos com transform/scroll quebrem a captura
      filter: (node) => {
        if (node instanceof HTMLElement) {
          // Remove outlines de seleção do react-rnd
          if (node.classList.contains("group/block")) {
            node.style.outline = "none";
          }
        }
        return true;
      },
    });
  } finally {
    el.style.transform = prev.transform;
    el.style.boxShadow = prev.boxShadow;
    el.style.outline = prev.outline;
  }
}

async function renderConfigToPng(config: CustomSlideConfig): Promise<string> {
  const host = document.createElement("div");
  // Renderiza VISÍVEL fora da tela (à direita) para que Recharts/tabelas
  // tenham layout real. Evitamos opacity:0 + z-index negativo, que em alguns
  // browsers degradam a renderização de SVG.
  host.style.position = "fixed";
  host.style.left = "100vw";
  host.style.top = "0";
  host.style.width = `${CANVAS_W}px`;
  host.style.height = `${CANVAS_H}px`;
  host.style.background = `#${config.background}`;
  host.style.overflow = "hidden";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  let root: Root | null = null;
  try {
    root = createRoot(host);
    root.render(
      <div style={{ position: "relative", width: CANVAS_W, height: CANVAS_H, background: `#${config.background}` }}>
        {[...config.blocks].sort((a, b) => a.z - b.z).map((blk) => (
          <div key={blk.id} style={{
            position: "absolute",
            left: blk.x, top: blk.y, width: blk.w, height: blk.h, zIndex: blk.z,
          }}>
            <BlockRenderer block={blk} readOnly />
          </div>
        ))}
      </div>,
    );
    // Espera extra para garantir que stores (Zustand) e SVG estejam prontos
    await new Promise((r) => setTimeout(r, 500));
    return await snapshotElement(host);
  } finally {
    if (root) root.unmount();
    if (host.parentNode) document.body.removeChild(host);
  }
}

export async function addCustomSlide(
  pptx: PptxGenJS,
  config: CustomSlideConfig,
  opts?: { slideId?: string },
) {
  const slide = pptx.addSlide();
  slide.background = { color: config.background };

  // Tenta capturar o canvas REAL no editor; se não encontrar, fallback off-DOM
  let png: string;
  const live = opts?.slideId ? getCustomCanvas(opts.slideId) : undefined;
  if (live && live.isConnected && live.offsetWidth > 0) {
    png = await snapshotElement(live);
  } else {
    png = await renderConfigToPng(config);
  }
  slide.addImage({ data: png, x: 0, y: 0, w: SLIDE_W_IN, h: SLIDE_H_IN });

  if (config.showHaraldFooter) {
    const footerData = await fetchAsDataUrl(haraldFooterPng);
    slide.addImage({
      data: footerData,
      x: 0, y: SLIDE_H_IN - FOOTER_H_IN,
      w: SLIDE_W_IN, h: FOOTER_H_IN,
    });
  }
}

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
