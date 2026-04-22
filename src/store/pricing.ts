import { create } from "zustand";
import type { Filters, LoadedFile, Metric, PricingRow } from "@/lib/types";

interface PricingState {
  rows: PricingRow[];
  files: LoadedFile[];
  metric: Metric;
  filters: Filters;
  selectedPeriods: string[] | null; // null = all
  // PVM
  pvmBase: string | null;
  pvmComp: string | null;

  setMetric: (m: Metric) => void;
  setFilter: (k: keyof Filters, v: string[]) => void;
  clearFilters: () => void;
  setSelectedPeriods: (p: string[] | null) => void;
  togglePeriod: (p: string) => void;
  setAllPeriods: () => void;

  addParsed: (rows: PricingRow[], file: LoadedFile, replaceMonths: boolean) => void;
  removeFile: (name: string) => void;
  clearAll: () => void;

  setPvm: (base: string | null, comp: string | null) => void;
}

export const usePricing = create<PricingState>((set, get) => ({
  rows: [],
  files: [],
  metric: "cm",
  filters: {},
  selectedPeriods: null,
  pvmBase: null,
  pvmComp: null,

  setMetric: (m) => set({ metric: m }),
  setFilter: (k, v) =>
    set((s) => ({ filters: { ...s.filters, [k]: v.length ? v : undefined } })),
  clearFilters: () => set({ filters: {} }),
  setSelectedPeriods: (p) => set({ selectedPeriods: p }),
  togglePeriod: (p) =>
    set((s) => {
      const all = Array.from(new Set(get().rows.map((r) => r.periodo))).sort();
      const cur = s.selectedPeriods ?? all;
      const next = cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p];
      return { selectedPeriods: next };
    }),
  setAllPeriods: () => set({ selectedPeriods: null }),

  addParsed: (newRows, file, replaceMonths) => {
    const newPeriods = new Set(newRows.map((r) => r.periodo));
    set((s) => {
      const keptRows = replaceMonths
        ? s.rows.filter((r) => !newPeriods.has(r.periodo))
        : s.rows;
      const keptFiles = replaceMonths
        ? s.files.filter((f) => !f.months.some((m) => newPeriods.has(m)))
        : s.files;
      return {
        rows: [...keptRows, ...newRows],
        files: [...keptFiles, file],
      };
    });
  },

  removeFile: (name) =>
    set((s) => {
      const file = s.files.find((f) => f.name === name);
      if (!file) return {};
      const removedPeriods = new Set(file.months);
      // Recompute remaining periods
      const remainingFiles = s.files.filter((f) => f.name !== name);
      const stillCoveredPeriods = new Set(remainingFiles.flatMap((f) => f.months));
      const rows = s.rows.filter((r) => {
        if (!removedPeriods.has(r.periodo)) return true;
        return stillCoveredPeriods.has(r.periodo);
      });
      return { rows, files: remainingFiles };
    }),

  clearAll: () => set({ rows: [], files: [], filters: {}, selectedPeriods: null, pvmBase: null, pvmComp: null }),

  setPvm: (base, comp) => set({ pvmBase: base, pvmComp: comp }),
}));
