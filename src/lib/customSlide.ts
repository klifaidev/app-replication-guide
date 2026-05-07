// Custom Slide — tipos e helpers para slide montado livremente pelo usuário.
// Sistema de coordenadas: 1333 x 750 (espelha SlidePreview e mapeia direto
// para 13.33" x 7.5" do LAYOUT_WIDE do PPT — basta dividir por 100).

import type { Filters } from "./types";

export const CANVAS_W = 1333;
export const CANVAS_H = 750;
// Faixa Harald no rodapé — mesma proporção do export (h ≈ 0.85" = 85 unidades)
export const FOOTER_H = 85;

export type CustomBlockKind =
  | "title"
  | "text"
  | "kpi"
  | "image"
  | "shape"
  | "bridge"
  | "table";

export interface BaseBlock {
  id: string;
  kind: CustomBlockKind;
  x: number; y: number; w: number; h: number;
  z: number;
}

export interface TitleBlock extends BaseBlock {
  kind: "title";
  text: string;
  size: number;     // px (no canvas)
  bold: boolean;
  color: string;    // hex sem #
  align: "left" | "center" | "right";
}

export interface TextBlock extends BaseBlock {
  kind: "text";
  text: string;
  size: number;
  color: string;
  align: "left" | "center" | "right";
}

export interface KpiBlock extends BaseBlock {
  kind: "kpi";
  label: string;
  value: string;          // formatado livremente pelo usuário
  valueSize: number;
  color: string;
}

export interface ImageBlock extends BaseBlock {
  kind: "image";
  /** data URI (base64) */
  src: string;
  fit: "contain" | "cover";
}

export interface ShapeBlock extends BaseBlock {
  kind: "shape";
  shape: "rect" | "line";
  fill: string;     // hex sem #
  radius: number;
}

export interface BridgeBlock extends BaseBlock {
  kind: "bridge";
  base: string | null;  // periodo
  comp: string | null;
  mode: "fy" | "month";
  filters: Filters;
}

export interface TableBlock extends BaseBlock {
  kind: "table";
  source: "ke30";   // futuro: budget
  measures: string[];      // ids de PivotMeasure
  rowDims: string[];       // dimensões em linha
  colDim: string | null;   // dimensão em coluna (opcional, ex.: periodo)
  filters: Filters;
}

export type CustomBlock =
  | TitleBlock | TextBlock | KpiBlock | ImageBlock
  | ShapeBlock | BridgeBlock | TableBlock;

export interface CustomSlideConfig {
  blocks: CustomBlock[];
  /** Cor de fundo do canvas (hex sem #) */
  background: string;
  /** Mostrar a faixa Harald no rodapé (default true) */
  showHaraldFooter: boolean;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
function rid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultCustomSlide(): CustomSlideConfig {
  return {
    background: "FFFFFF",
    showHaraldFooter: true,
    blocks: [
      {
        id: rid(), kind: "title", z: 1,
        x: 40, y: 30, w: 900, h: 70,
        text: "Título do slide", size: 44, bold: true,
        color: "C8102E", align: "left",
      } as TitleBlock,
    ],
  };
}

export function newBlock(kind: CustomBlockKind, zTop: number): CustomBlock {
  const id = rid();
  const z = zTop + 1;
  switch (kind) {
    case "title":
      return { id, kind, z, x: 60, y: 60, w: 800, h: 70,
        text: "Novo título", size: 40, bold: true, color: "C8102E", align: "left" };
    case "text":
      return { id, kind, z, x: 60, y: 150, w: 600, h: 60,
        text: "Clique para editar este texto.", size: 18, color: "1C2430", align: "left" };
    case "kpi":
      return { id, kind, z, x: 60, y: 200, w: 280, h: 130,
        label: "ROL", value: "R$ 1.234.567", valueSize: 36, color: "C8102E" };
    case "image":
      return { id, kind, z, x: 80, y: 220, w: 360, h: 220, src: "", fit: "contain" };
    case "shape":
      return { id, kind, z, x: 80, y: 240, w: 240, h: 140,
        shape: "rect", fill: "EEF2F6", radius: 8 };
    case "bridge":
      return { id, kind, z, x: 60, y: 200, w: 1200, h: 380,
        base: null, comp: null, mode: "month", filters: {} };
    case "table":
      return { id, kind, z, x: 60, y: 200, w: 1200, h: 360,
        source: "ke30", measures: ["rol_real", "cm_real"],
        rowDims: ["marca"], colDim: "periodo", filters: {} };
  }
}

export const BLOCK_LABELS: Record<CustomBlockKind, string> = {
  title: "Título",
  text: "Texto",
  kpi: "KPI",
  image: "Imagem",
  shape: "Forma",
  bridge: "Bridge PVM",
  table: "Tabela",
};
