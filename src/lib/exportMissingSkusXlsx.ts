import * as XLSX from "xlsx";

interface MissingSku {
  sku: string;
  descricao?: string;
}

const HEADERS = [
  "SKU",
  "Descrição (referência)",
  "Categoria",
  "Subcategoria",
  "Marca",
  "Tecnologia",
  "Formato",
  "Mercado",
  "Faixa de Peso",
  "Sabor",
  "Descrição SKU (oficial)",
];

export function exportMissingSkusXlsx(missing: MissingSku[]) {
  const rows: (string | number)[][] = [HEADERS];
  for (const m of missing) {
    rows.push([m.sku, m.descricao ?? "", "", "", "", "", "", "", "", "", ""]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 38 },
    { wch: 16 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 38 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SKUs faltantes");

  const today = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `skus_faltantes_depara_${today}.xlsx`);
}
