// Exportador do slide "Personalizado" para PPTX.
// Estratégia: renderiza o canvas off-screen como DOM real, faz snapshot
// para PNG via html-to-image e adiciona como imagem que ocupa todo o slide.
// Isso garante fidelidade pixel-perfect ao que o usuário desenhou no app.

import type PptxGenJS from "pptxgenjs";
import { createRoot, type Root } from "react-dom/client";
import { toPng } from "html-to-image";
import { CANVAS_W, CANVAS_H, type CustomSlideConfig } from "./customSlide";
import { BlockRenderer } from "@/components/pricing/custom/BlockRenderer";
import haraldFooterPng from "@/assets/harald-footer-bar.png";

const SLIDE_W_IN = 13.33;
const SLIDE_H_IN = 7.5;
const FOOTER_H_IN = 0.85;

async function renderConfigToPng(config: CustomSlideConfig): Promise<string> {
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = `${CANVAS_W}px`;
  host.style.height = `${CANVAS_H}px`;
  host.style.background = `#${config.background}`;
  host.style.overflow = "hidden";
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
    // Aguarda render + paint
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, 120));

    const dataUrl = await toPng(host, {
      pixelRatio: 2, width: CANVAS_W, height: CANVAS_H,
      backgroundColor: `#${config.background}`,
      cacheBust: true,
    });
    return dataUrl;
  } finally {
    if (root) root.unmount();
    document.body.removeChild(host);
  }
}

export async function addCustomSlide(pptx: PptxGenJS, config: CustomSlideConfig) {
  const slide = pptx.addSlide();
  slide.background = { color: config.background };
  const png = await renderConfigToPng(config);
  slide.addImage({ data: png, x: 0, y: 0, w: SLIDE_W_IN, h: SLIDE_H_IN });

  // Faixa Harald sobreposta como imagem nativa do PPT — assim ela aparece
  // crisp e idêntica aos slides Bridge/Budget.
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
