import Papa from "papaparse";
import type { LoadedFile, PricingRow } from "./types";
import { normHeader, parseDecimal, parsePeriod } from "./format";

// Map of normalized header → canonical field
const HEADER_MAP: Record<string, keyof PricingRow | "ignore"> = {
  // period
  periodo: "periodo",
  período: "periodo",
  mes: "periodo",
  // dims
  marca: "marca",
  canal: "canal",
  canalvenda: "canal",
  categoria: "categoria",
  subcategoria: "subcategoria",
  sku: "sku",
  codsku: "sku",
  codigosku: "sku",
  descricaosku: "skuDesc",
  descsku: "skuDesc",
  produto: "skuDesc",
  cliente: "cliente",
  razaosocial: "cliente",
  regiao: "regiao",
  região: "regiao",
  uf: "regiao",
  mercado: "mercado",
  sabor: "sabor",
  tecnologia: "tecnologia",
  faixapeso: "faixaPeso",
  faixadepeso: "faixaPeso",
  // measures
  rol: "rol",
  receita: "rol",
  receitaoperacionalliquida: "rol",
  volume: "volumeKg",
  volumekg: "volumeKg",
  kg: "volumeKg",
  cogs: "cogs",
  cmv: "cogs",
  custo: "cogs",
  margembruta: "margemBruta",
  mb: "margemBruta",
  contribuicaomarginal: "contribMarginal",
  contribmarginal: "contribMarginal",
  cm: "contribMarginal",
};

function detectDelimiter(sample: string): string {
  const counts = [";", ",", "\t", "|"].map((d) => ({
    d,
    n: (sample.match(new RegExp(`\\${d}`, "g")) || []).length,
  }));
  counts.sort((a, b) => b.n - a.n);
  return counts[0].d || ";";
}

export interface ParsedCsv {
  rows: PricingRow[];
  file: LoadedFile;
  warnings: string[];
}

export async function parseCsvFile(file: File): Promise<ParsedCsv> {
  // Try UTF-8 first; fallback to Windows-1252 if replacement char detected
  let text = await file.text();
  if (text.includes("\uFFFD")) {
    try {
      const buf = await file.arrayBuffer();
      text = new TextDecoder("windows-1252").decode(buf);
    } catch {
      /* keep utf-8 */
    }
  }

  const sample = text.split("\n").slice(0, 5).join("\n");
  const delimiter = detectDelimiter(sample);

  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const warnings: string[] = [];
  const rows: PricingRow[] = [];
  const monthsSet = new Set<string>();

  // Build column map
  const sampleRow = result.data[0] ?? {};
  const colMap: Record<string, keyof PricingRow> = {};
  for (const rawHeader of Object.keys(sampleRow)) {
    const key = normHeader(rawHeader);
    const canonical = HEADER_MAP[key];
    if (canonical && canonical !== "ignore") {
      colMap[rawHeader] = canonical as keyof PricingRow;
    }
  }

  for (const raw of result.data) {
    const obj: Partial<PricingRow> = {};
    for (const [src, dest] of Object.entries(colMap)) {
      const val = raw[src];
      if (
        dest === "rol" || dest === "volumeKg" || dest === "cogs" ||
        dest === "margemBruta" || dest === "contribMarginal"
      ) {
        (obj as Record<string, number>)[dest] = parseDecimal(val);
      } else {
        (obj as Record<string, string>)[dest] = (val ?? "").toString().trim();
      }
    }

    const period = parsePeriod(obj.periodo as string);
    if (!period) continue;
    obj.periodo = period.periodo;
    obj.mes = period.mes;
    obj.ano = period.ano;
    obj.fy = period.fy;
    obj.fyNum = period.fyNum;

    obj.rol = obj.rol ?? 0;
    obj.volumeKg = obj.volumeKg ?? 0;
    obj.cogs = obj.cogs ?? 0;
    obj.margemBruta = obj.margemBruta ?? (obj.rol! - obj.cogs!);
    obj.contribMarginal = obj.contribMarginal ?? obj.margemBruta;

    if ((obj.rol ?? 0) <= 0) continue;

    monthsSet.add(period.periodo);
    rows.push(obj as PricingRow);
  }

  if (rows.length === 0) {
    warnings.push("Nenhuma linha válida encontrada (verifique colunas e período).");
  }

  return {
    rows,
    file: {
      name: file.name,
      rowCount: rows.length,
      months: Array.from(monthsSet).sort(),
    },
    warnings,
  };
}
