// De Para — classifica SKUs como "Inovação" ou "Regular".
// Funciona para Base Real e Budget, usando o SKU como chave.
import raw from "@/data/depara_inovacao.json";

export type InovacaoClass = "Inovação" | "Regular";

interface InovacaoEntry {
  classificacao: string;
  anoLancamento?: number | string | null;
  legado?: string | null;
}

const MAP = raw as Record<string, InovacaoEntry>;

export function getInovacao(sku: string | undefined | null): InovacaoClass {
  if (!sku) return "Regular";
  const key = String(sku).trim();
  if (!key) return "Regular";
  const entry = MAP[key];
  if (entry && /inova/i.test(entry.classificacao)) return "Inovação";
  return "Regular";
}

export const INOVACAO_SKUS = Object.keys(MAP);
