// Renderer das tabelas/blocos do slide personalizado.
// Cada bloco recebe coordenadas no sistema do canvas (1333x750) e é
// renderizado em modo absoluto. Usado tanto no editor (com seleção/resize
// via react-rnd no wrapper externo) quanto na prévia (modo readOnly).

import { useMemo } from "react";
import type {
  CustomBlock, TitleBlock, TextBlock, KpiBlock, ImageBlock,
  ShapeBlock, BridgeBlock, TableBlock,
} from "@/lib/customSlide";
import { applyFilters, calcPVM } from "@/lib/analytics";
import { Waterfall } from "@/components/pricing/Waterfall";
import { computePivot, type PivotConfig, type PivotMeasure } from "@/lib/pivot";
import { buildUnifiedRows, ALL_DIMENSIONS } from "@/lib/pivotData";
import { usePricing } from "@/store/pricing";
import { useBudget } from "@/store/budget";
import { monthLabel, formatBRL } from "@/lib/format";

// Catálogo simplificado de medidas para o bloco Tabela (KE30).
export const CUSTOM_TABLE_MEASURES: PivotMeasure[] = [
  { id: "rol_real",  label: "ROL",            field: "rol_real",         agg: "sum", format: "currency", tone: "real" },
  { id: "vol_real",  label: "Volume (Kg)",    field: "volumeKg_real",    agg: "sum", format: "tons",     tone: "real" },
  { id: "cm_real",   label: "Contrib. Marg.", field: "cm_real",          agg: "sum", format: "currency", tone: "real" },
  { id: "cv_real",   label: "Custo Variável", field: "custoVariavel_real", agg: "sum", format: "currency", tone: "real" },
  { id: "frete_real",label: "Frete",          field: "frete_real",       agg: "sum", format: "currency", tone: "real" },
  { id: "com_real",  label: "Comissão",       field: "comissao_real",    agg: "sum", format: "currency", tone: "real" },
  { id: "mb_real",   label: "Margem Bruta",   field: "mb_real",          agg: "sum", format: "currency", tone: "real" },
];

export const CUSTOM_TABLE_DIMS = ALL_DIMENSIONS;

function fmtMeasure(m: PivotMeasure, v: number): string {
  if (!isFinite(v)) return "—";
  if (m.format === "currency") return formatBRL(v);
  if (m.format === "percent") return `${(v * 100).toFixed(1)}%`;
  if (m.format === "tons") return Math.round(v).toLocaleString("pt-BR");
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

// ---------------------------------------------------------------------------
// Block renderers
// ---------------------------------------------------------------------------
export function BlockRenderer({ block, readOnly }: { block: CustomBlock; readOnly?: boolean }) {
  switch (block.kind) {
    case "title":  return <TitleRender block={block} />;
    case "text":   return <TextRender block={block} />;
    case "kpi":    return <KpiRender block={block} />;
    case "image":  return <ImageRender block={block} />;
    case "shape":  return <ShapeRender block={block} />;
    case "bridge": return <BridgeRender block={block} />;
    case "table":  return <TableRender block={block} />;
  }
}

function TitleRender({ block: b }: { block: TitleBlock }) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex",
      alignItems: "center", justifyContent: b.align,
      fontFamily: "Calibri, sans-serif", fontSize: b.size,
      fontWeight: b.bold ? 700 : 400, color: `#${b.color}`,
      lineHeight: 1.1, textAlign: b.align,
      padding: 0, overflow: "hidden",
    }}>
      {b.text}
    </div>
  );
}

function TextRender({ block: b }: { block: TextBlock }) {
  return (
    <div style={{
      width: "100%", height: "100%", display: "flex",
      alignItems: "flex-start", justifyContent: b.align,
      fontFamily: "Calibri, sans-serif", fontSize: b.size,
      color: `#${b.color}`, textAlign: b.align,
      whiteSpace: "pre-wrap", overflow: "hidden", lineHeight: 1.3,
    }}>
      {b.text}
    </div>
  );
}

function KpiRender({ block: b }: { block: KpiBlock }) {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: 12, borderRadius: 12,
      background: "#F8FAFC", border: "1px solid #E2E8F0",
      fontFamily: "Calibri, sans-serif",
    }}>
      <div style={{ fontSize: 14, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 }}>
        {b.label}
      </div>
      <div style={{ fontSize: b.valueSize, fontWeight: 700, color: `#${b.color}`, marginTop: 4, lineHeight: 1 }}>
        {b.value}
      </div>
    </div>
  );
}

function ImageRender({ block: b }: { block: ImageBlock }) {
  if (!b.src) {
    return (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#F1F5F9", border: "1px dashed #94A3B8",
        color: "#64748B", fontFamily: "Calibri", fontSize: 14,
      }}>
        Faça upload de uma imagem
      </div>
    );
  }
  return (
    <img src={b.src} alt=""
      style={{ width: "100%", height: "100%", objectFit: b.fit, display: "block" }}
    />
  );
}

function ShapeRender({ block: b }: { block: ShapeBlock }) {
  if (b.shape === "line") {
    return (
      <div style={{
        width: "100%", height: 0, borderTop: `${Math.max(2, b.h)}px solid #${b.fill}`,
        marginTop: b.h / 2,
      }} />
    );
  }
  return (
    <div style={{
      width: "100%", height: "100%",
      background: `#${b.fill}`, borderRadius: b.radius,
    }} />
  );
}

function BridgeRender({ block: b }: { block: BridgeBlock }) {
  const pricing = usePricing((s) => s.rows);
  const metric = usePricing((s) => s.metric);

  const pvm = useMemo(() => {
    if (!b.base || !b.comp || b.base === b.comp) return null;
    const filtered = applyFilters(pricing, b.filters, null);
    const labels = b.mode === "month" ? {
      base: (() => { const r = filtered.find((x) => x.periodo === b.base); return r ? monthLabel(r.mes, r.ano) : b.base!; })(),
      comp: (() => { const r = filtered.find((x) => x.periodo === b.comp); return r ? monthLabel(r.mes, r.ano) : b.comp!; })(),
    } : undefined;
    try { return calcPVM(filtered, metric, b.base, b.comp, b.mode, labels); }
    catch { return null; }
  }, [pricing, metric, b.base, b.comp, b.mode, b.filters]);

  if (!pvm) {
    return (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#F8FAFC", border: "1px dashed #CBD5E1",
        color: "#64748B", fontFamily: "Calibri", fontSize: 14,
      }}>
        Configure base e comparação para a Bridge
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Waterfall data={pvm} height={9999} />
    </div>
  );
}

function TableRender({ block: b }: { block: TableBlock }) {
  const pricing = usePricing((s) => s.rows);
  const budget = useBudget((s) => s.rows);

  const data = useMemo(() => {
    const unified = buildUnifiedRows(pricing, budget, "real");
    const measures = CUSTOM_TABLE_MEASURES.filter((m) => b.measures.includes(m.id));
    if (measures.length === 0) return null;
    const cfg: PivotConfig = {
      rows: b.rowDims,
      cols: b.colDim ? [b.colDim] : [],
      values: measures,
      filters: Object.fromEntries(Object.entries(b.filters).map(([k, v]) => [k, new Set(v ?? [])])),
    };
    const result = computePivot(unified as unknown as Record<string, unknown>[], cfg);
    return { result, measures };
  }, [pricing, budget, b.rowDims, b.colDim, b.measures, b.filters]);

  if (!data || data.result.rowHeaders.length === 0) {
    return (
      <div style={{
        width: "100%", height: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "#F8FAFC", border: "1px dashed #CBD5E1",
        color: "#64748B", fontFamily: "Calibri", fontSize: 14,
      }}>
        Configure dimensões e medidas da tabela
      </div>
    );
  }

  const { result, measures } = data;
  const cols = result.colHeaders;
  const showCols = cols.length > 0 && cols[0].values.length > 0;

  return (
    <div style={{ width: "100%", height: "100%", overflow: "auto", fontFamily: "Calibri", fontSize: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={cellHead}>{b.rowDims.map((d) => labelOfDim(d)).join(" / ") || "Total"}</th>
            {showCols
              ? cols.flatMap((c) => measures.map((m) => (
                  <th key={`${c.key}-${m.id}`} style={cellHead}>{c.values.join(" / ")} · {m.label}</th>
                )))
              : measures.map((m) => <th key={m.id} style={cellHead}>{m.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {result.rowHeaders.map((rh) => (
            <tr key={rh.key}>
              <td style={cellLabel}>{rh.values.join(" / ") || "Total"}</td>
              {showCols
                ? cols.flatMap((c) => measures.map((m) => {
                    const v = result.cells.get(rh.key)?.get(c.key)?.[m.id] ?? 0;
                    return <td key={`${c.key}-${m.id}`} style={cellVal}>{fmtMeasure(m, v)}</td>;
                  }))
                : measures.map((m) => {
                    const v = result.rowTotals.get(rh.key)?.[m.id] ?? 0;
                    return <td key={m.id} style={cellVal}>{fmtMeasure(m, v)}</td>;
                  })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellHead: React.CSSProperties = {
  background: "#C8102E", color: "#fff", padding: "6px 8px", textAlign: "center",
  fontWeight: 700, fontSize: 11, border: "1px solid #fff",
};
const cellLabel: React.CSSProperties = {
  padding: "5px 8px", textAlign: "left", fontWeight: 600,
  color: "#1C2430", borderBottom: "1px solid #E2E8F0", background: "#fff",
};
const cellVal: React.CSSProperties = {
  padding: "5px 8px", textAlign: "right", color: "#1C2430",
  borderBottom: "1px solid #E2E8F0", background: "#fff",
};

function labelOfDim(id: string): string {
  return ALL_DIMENSIONS.find((d) => d.id === id)?.label ?? id;
}
