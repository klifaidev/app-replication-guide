import type { Filters, Metric, PricingRow } from "./types";

export const measureOf = (r: PricingRow, m: Metric) =>
  m === "cm" ? r.contribMarginal : r.margemBruta;

export function applyFilters(
  rows: PricingRow[],
  filters: Filters,
  selectedPeriods: string[] | null,
): PricingRow[] {
  return rows.filter((r) => {
    if (selectedPeriods && selectedPeriods.length && !selectedPeriods.includes(r.periodo)) return false;
    for (const [k, vals] of Object.entries(filters)) {
      if (!vals || vals.length === 0) continue;
      const v = (r as unknown as Record<string, unknown>)[k] as string | undefined;
      if (!v || !vals.includes(v)) return false;
    }
    return true;
  });
}

export interface KPI {
  rol: number;
  margem: number;
  margemPct: number;
  volumeKg: number;
  skus: number;
}

export function computeKPIs(rows: PricingRow[], metric: Metric): KPI {
  let rol = 0, margem = 0, volumeKg = 0;
  const skuSet = new Set<string>();
  for (const r of rows) {
    rol += r.rol;
    margem += measureOf(r, metric);
    volumeKg += r.volumeKg;
    if (r.sku) skuSet.add(r.sku);
  }
  return {
    rol,
    margem,
    margemPct: rol > 0 ? margem / rol : 0,
    volumeKg,
    skus: skuSet.size,
  };
}

export interface AggRow {
  key: string;
  rol: number;
  margem: number;
  margemPct: number;
  volumeKg: number;
  rolPorKg: number;
}

export function aggregateBy(
  rows: PricingRow[],
  metric: Metric,
  keyFn: (r: PricingRow) => string,
): AggRow[] {
  const map = new Map<string, { rol: number; margem: number; volumeKg: number }>();
  for (const r of rows) {
    const k = keyFn(r) || "—";
    const cur = map.get(k) ?? { rol: 0, margem: 0, volumeKg: 0 };
    cur.rol += r.rol;
    cur.margem += measureOf(r, metric);
    cur.volumeKg += r.volumeKg;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      rol: v.rol,
      margem: v.margem,
      margemPct: v.rol > 0 ? v.margem / v.rol : 0,
      volumeKg: v.volumeKg,
      rolPorKg: v.volumeKg > 0 ? v.rol / v.volumeKg : 0,
    }))
    .sort((a, b) => b.rol - a.rol);
}

export interface PVMResult {
  base: number;
  volume: number;
  price: number;
  cost: number;       // Custo variável (CPV)
  freight: number;    // Frete sobre vendas
  commission: number; // Comissão
  others: number;     // Mix + outros (resíduo)
  current: number;
  baseLabel: string;
  currentLabel: string;
}

/**
 * Detailed PVM bridge between two periods (FY or month).
 * Decomposes CM/MB variation into:
 *   Volume · Preço · Custo Variável · Frete · Comissão · Outros (mix + resíduo)
 *
 * Per-SKU effects use comp-period volumes for unit deltas; volume effect uses
 * base CM unit margin × Δvolume (classic PVM approach).
 *
 * `mode`: "fy" compares by `r.fy`, "month" compares by `r.periodo`.
 */
export function calcPVM(
  rows: PricingRow[],
  metric: Metric,
  base: string,
  comp: string,
  mode: "fy" | "month" = "fy",
  labels?: { base?: string; comp?: string },
): PVMResult {
  const keyOf = (r: PricingRow) => (mode === "fy" ? r.fy : r.periodo);
  const baseRows = rows.filter((r) => keyOf(r) === base);
  const compRows = rows.filter((r) => keyOf(r) === comp);

  interface Agg {
    vol: number;
    rol: number;
    cogs: number;
    frete: number;
    comissao: number;
    margem: number;
  }

  const aggSku = (rs: PricingRow[]) => {
    const m = new Map<string, Agg>();
    for (const r of rs) {
      const k = r.sku || r.skuDesc || "—";
      const c = m.get(k) ?? { vol: 0, rol: 0, cogs: 0, frete: 0, comissao: 0, margem: 0 };
      c.vol += r.volumeKg;
      c.rol += r.rol;
      c.cogs += r.cogs;
      c.frete += r.frete ?? 0;
      c.comissao += r.comissao ?? 0;
      c.margem += measureOf(r, metric);
      m.set(k, c);
    }
    return m;
  };

  const a = aggSku(baseRows);
  const b = aggSku(compRows);

  let baseTotal = 0, currentTotal = 0;
  for (const v of a.values()) { baseTotal += v.margem; }
  for (const v of b.values()) { currentTotal += v.margem; }

  let volEffect = 0;
  let priceEffect = 0;
  let costEffect = 0;
  let freightEffect = 0;
  let commissionEffect = 0;

  const allSkus = new Set([...a.keys(), ...b.keys()]);
  for (const sku of allSkus) {
    const ra = a.get(sku);
    const rb = b.get(sku);
    if (!ra || !rb || ra.vol === 0 || rb.vol === 0) continue;

    // Efeito Volume no nível do SKU: ΔV × margem unitária base daquele SKU
    const margemUnitA = ra.margem / ra.vol;
    volEffect += (rb.vol - ra.vol) * margemUnitA;

    // Laspeyres: efeitos unitários valorizados pelo VOLUME BASE (A)
    const priceA = ra.rol / ra.vol;
    const priceB = rb.rol / rb.vol;
    const costA = ra.cogs / ra.vol;
    const costB = rb.cogs / rb.vol;
    const freightA = ra.frete / ra.vol;
    const freightB = rb.frete / rb.vol;
    const commA = ra.comissao / ra.vol;
    const commB = rb.comissao / rb.vol;

    priceEffect += (priceB - priceA) * ra.vol;
    costEffect -= (costB - costA) * ra.vol;
    freightEffect -= (freightB - freightA) * ra.vol;
    commissionEffect -= (commB - commA) * ra.vol;
  }

  const others =
    currentTotal - baseTotal - volEffect - priceEffect - costEffect - freightEffect - commissionEffect;

  return {
    base: baseTotal,
    volume: volEffect,
    price: priceEffect,
    cost: costEffect,
    freight: freightEffect,
    commission: commissionEffect,
    others,
    current: currentTotal,
    baseLabel: labels?.base ?? base,
    currentLabel: labels?.comp ?? comp,
  };
}

export function uniqueValues<K extends keyof PricingRow>(rows: PricingRow[], key: K): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[key];
    if (typeof v === "string" && v) set.add(v);
  }
  return Array.from(set).sort();
}
