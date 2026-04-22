export const formatBRL = (v: number, opts?: { compact?: boolean; digits?: number }) => {
  if (!isFinite(v)) return "—";
  const { compact, digits = 0 } = opts ?? {};
  if (compact) {
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) return `R$ ${(v / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  }
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const formatNum = (v: number, digits = 0, compact = false) => {
  if (!isFinite(v)) return "—";
  if (compact) {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  }
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const formatPct = (v: number, digits = 1) => {
  if (!isFinite(v)) return "—";
  return `${(v * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
};

export const formatTon = (kg: number) => `${formatNum(kg / 1000, 1)} t`;

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const monthLabel = (mes: number, ano: number) =>
  `${MONTH_LABELS[mes - 1] ?? "?"}/${String(ano).slice(-2)}`;

/**
 * Parse a period string like "005.2025" or "5/2025" or "2025-05" into {mes, ano, fy, fyNum}
 * Fiscal year: April–March. FY25/26 = April 2025 → March 2026.
 */
export function parsePeriod(raw: string | number): {
  periodo: string;
  mes: number;
  ano: number;
  fy: string;
  fyNum: number;
} | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;

  let mes = 0;
  let ano = 0;

  // "005.2025" or "5.2025" or "05/2025"
  const m1 = s.match(/^0*(\d{1,2})[./-](\d{4})$/);
  // "2025-05" or "2025/05"
  const m2 = s.match(/^(\d{4})[./-]0*(\d{1,2})$/);
  // "5-2025"
  if (m1) {
    mes = parseInt(m1[1], 10);
    ano = parseInt(m1[2], 10);
  } else if (m2) {
    ano = parseInt(m2[1], 10);
    mes = parseInt(m2[2], 10);
  } else {
    return null;
  }
  if (mes < 1 || mes > 12 || ano < 2000 || ano > 2099) return null;

  // FY (April–March)
  const fyStart = mes >= 4 ? ano : ano - 1;
  const fyEnd = fyStart + 1;
  const fy = `FY${String(fyStart).slice(-2)}/${String(fyEnd).slice(-2)}`;
  const fyNum = fyStart * 100 + (fyEnd % 100);
  const periodo = `${String(mes).padStart(3, "0")}.${ano}`;

  return { periodo, mes, ano, fy, fyNum };
}

/** normalize header: lowercase, strip accents/spaces/punct */
export const normHeader = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

/** parse "1.234,56" or "1,234.56" or "123.45" → number */
export function parseDecimal(raw: unknown): number {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;
  let s = String(raw).trim().replace(/\s/g, "").replace(/R\$/i, "");
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/^[-(]+|[)]+$/g, "");
  // BR: "1.234,56" → "1234.56"
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && !s.includes(".")) {
    // "1234,56"
    s = s.replace(",", ".");
  } else {
    // "1,234.56" — strip thousand commas
    s = s.replace(/,/g, "");
  }
  const n = parseFloat(s);
  if (!isFinite(n)) return 0;
  return negative ? -n : n;
}
