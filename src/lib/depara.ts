// De Para — fonte de verdade para atributos de SKU.
// Sobrescreve qualquer valor vindo do CSV original.
import deparaJson from "@/data/depara.json";

export interface DeParaEntry {
  categoria: string;
  subcategoria: string;
  marca: string;
  tecnologia: string;
  formato: string;
  mercado: string;
  faixaPeso: string;
  sabor: string;
  skuDesc: string;
}

const RAW = deparaJson as Record<string, DeParaEntry>;

/** Lookup direto por código SKU (string). */
export function getDeParaBySku(sku: string | undefined | null): DeParaEntry | null {
  if (!sku) return null;
  const key = String(sku).trim();
  if (!key) return null;
  return RAW[key] ?? null;
}

export const DEPARA_SIZE = Object.keys(RAW).length;
