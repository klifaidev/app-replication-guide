// Renderer dos blocos do slide personalizado.

import { useMemo } from "react";
import type {
  CustomBlock, TitleBlock, TextBlock, KpiBlock, ImageBlock,
  ShapeBlock, BridgeBlock, TableBlock, ChartBlock, TopSkuBlock,
} from "@/lib/customSlide";
import { applyFilters, calcPVM } from "@/lib/analytics";
import { Waterfall } from "@/components/pricing/Waterfall";
import { computePivot, type PivotConfig, type PivotMeasure } from "@/lib/pivot";
import { buildUnifiedRows, ALL_DIMENSIONS } from "@/lib/pivotData";
import { usePricing } from "@/store/pricing";
import { useBudget } from "@/store/budget";
import { monthLabel, formatBRL, formatNum } from "@/lib/format";
import {
  computeKpiBlock, computeChartSeries, computeTopRanking, formatValue, inferFormat,
} from "@/lib/customKpi";
import { KPI_MEASURES } from "@/lib/customSlide";

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

export function BlockRenderer({ block, readOnly: _readOnly }: { block: CustomBlock; readOnly?: boolean }) {
  switch (block.kind) {
    case "title":  return <TitleRender block={block} />;
    case "text":   return <TextRender block={block} />;
    case "kpi":    return <KpiRender block={block} />;
    case "image":  return <ImageRender block={block} />;
    case "shape":  return <ShapeRender block={block} />;
    case "bridge": return <BridgeRender block={block} />;
    case "table":  return <TableRender block={block} />;
    case "chart":  return <ChartRender block={block} />;
    case "topSku": return <TopSkuRender block={block} />;
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
  const pricing = usePricing((s) => s.rows);
  const value = useMemo(() => computeKpiBlock(pricing, b), [pricing, b]);
  const measureLabel = b.source === "dynamic"
    ? KPI_MEASURES.find((m) => m.id === b.measure)?.label
    : null;

  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: 12, borderRadius: 12,
      background: "#F8FAFC", border: "1px solid #E2E8F0",
      fontFamily: "Calibri, sans-serif",
    }}>
      <div style={{ fontSize: 14, color: "#64748B", textTransform: "uppercase", letterSpacing: 1 }}>
        {b.label || measureLabel || "KPI"}
      </div>
      <div style={{
        fontSize: b.valueSize, fontWeight: 700, color: `#${b.color}`,
        marginTop: 4, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>
        {value}
      </div>
      {b.source === "dynamic" && (
        <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>
          {measureLabel}
          {b.periodMode && b.periodMode !== "all" && b.periodValue
            ? ` · ${b.periodValue}`
            : b.periodMode === "all" ? " · Todos os períodos" : ""}
        </div>
      )}
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
      <Waterfall data={pvm} height={Math.max(220, b.h - 4)} />
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

// ---------------------------------------------------------------------------
// Chart (line/bar) — SVG nativo (sem Recharts) para exportar bem como PNG
// ---------------------------------------------------------------------------
const CHART_COLORS = ["#C8102E", "#1C2430", "#0F766E", "#7C3AED", "#EA580C", "#2563EB", "#0EA5E9", "#16A34A"];

function ChartRender({ block: b }: { block: ChartBlock }) {
  const pricing = usePricing((s) => s.rows);
  const data = useMemo(
    () => computeChartSeries(pricing, b.filters, b.measure, b.breakdown),
    [pricing, b.filters, b.measure, b.breakdown],
  );

  if (data.periodos.length === 0 || data.series.length === 0) {
    return (
      <div style={{
        width: "100%", height: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "#F8FAFC", border: "1px dashed #CBD5E1",
        color: "#64748B", fontFamily: "Calibri", fontSize: 14,
      }}>
        Sem dados para os filtros escolhidos
      </div>
    );
  }

  const W = 1000, H = 400;
  const padL = 70, padR = 20, padT = 30, padB = 50;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const allVals = data.series.flatMap((s) => s.values).filter(isFinite);
  let minV = Math.min(0, ...allVals), maxV = Math.max(0, ...allVals);
  if (minV === maxV) { minV -= 1; maxV += 1; }
  const pad = (maxV - minV) * 0.1;
  minV -= pad; maxV += pad;
  const yOf = (v: number) => padT + (1 - (v - minV) / (maxV - minV)) * innerH;
  const xStep = innerW / Math.max(1, data.periodos.length);
  const xOf = (i: number) => padL + xStep * (i + 0.5);

  const measureFmt = inferFormat(b.measure);
  const fmt = (v: number) => formatValue(v, measureFmt, b.measure);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: "Calibri" }}>
      {b.title && (
        <div style={{ fontSize: 16, fontWeight: 700, color: "#C8102E", padding: "4px 8px" }}>
          {b.title}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%" }}>
          {b.showGrid && [0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const v = minV + (maxV - minV) * (1 - t);
            const y = padT + innerH * t;
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#E2E8F0" strokeDasharray={t === 1 ? "" : "3 4"} />
                <text x={padL - 6} y={y + 3} fontSize="10" fill="#64748B" textAnchor="end">{fmt(v)}</text>
              </g>
            );
          })}

          {data.periodos.map((p, i) => (
            <text key={p.key} x={xOf(i)} y={H - padB + 16} fontSize="10" fill="#64748B" textAnchor="middle">
              {p.label}
            </text>
          ))}

          {b.chartType === "line"
            ? data.series.map((s, si) => {
                const color = CHART_COLORS[si % CHART_COLORS.length];
                const path = s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${xOf(i)} ${yOf(v)}`).join(" ");
                return (
                  <g key={s.name}>
                    <path d={path} stroke={color} strokeWidth={2.5} fill="none" />
                    {s.values.map((v, i) => (
                      <g key={i}>
                        <circle cx={xOf(i)} cy={yOf(v)} r={3} fill={color} />
                        {b.showLabels && (
                          <text x={xOf(i)} y={yOf(v) - 8} fontSize="10" fill={color} textAnchor="middle" fontWeight={600}>
                            {fmt(v)}
                          </text>
                        )}
                      </g>
                    ))}
                  </g>
                );
              })
            : (() => {
                const sCount = data.series.length;
                const slot = xStep * 0.8 / sCount;
                return data.series.map((s, si) => {
                  const color = CHART_COLORS[si % CHART_COLORS.length];
                  return (
                    <g key={s.name}>
                      {s.values.map((v, i) => {
                        const cx = xOf(i) - (xStep * 0.8) / 2 + slot * si;
                        const yTop = yOf(Math.max(0, v));
                        const yBot = yOf(Math.min(0, v));
                        return (
                          <g key={i}>
                            <rect x={cx} y={yTop} width={slot - 2} height={Math.max(1, yBot - yTop)} fill={color} />
                            {b.showLabels && (
                              <text x={cx + slot / 2} y={yTop - 4} fontSize="9" fill={color} textAnchor="middle" fontWeight={600}>
                                {fmt(v)}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                });
              })()}
        </svg>
      </div>
      {b.showLegend && data.series.length > 0 && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "4px 8px", fontSize: 11, color: "#1C2430" }}>
          {data.series.map((s, si) => (
            <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 12, height: 12, background: CHART_COLORS[si % CHART_COLORS.length], borderRadius: 2 }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top SKU / Top Ranking
// ---------------------------------------------------------------------------
function TopSkuRender({ block: b }: { block: TopSkuBlock }) {
  const pricing = usePricing((s) => s.rows);
  const items = useMemo(
    () => computeTopRanking(pricing, b.filters, b.dim, b.measure, b.topN, b.periodMode, b.periodValue),
    [pricing, b.filters, b.dim, b.measure, b.topN, b.periodMode, b.periodValue],
  );
  const fmt = (v: number) => formatValue(v, inferFormat(b.measure), b.measure);
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", fontFamily: "Calibri" }}>
      {b.title && (
        <div style={{ fontSize: 16, fontWeight: 700, color: "#C8102E", padding: "4px 8px" }}>
          {b.title}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "0 8px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#C8102E", color: "#fff" }}>
              <th style={topHead}>#</th>
              <th style={{ ...topHead, textAlign: "left" }}>Item</th>
              <th style={{ ...topHead, textAlign: "right" }}>Valor</th>
              {b.showShare && <th style={{ ...topHead, textAlign: "right" }}>%</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.name} style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td style={{ padding: "4px 6px", color: "#64748B", fontWeight: 600 }}>{i + 1}</td>
                <td style={{ padding: "4px 6px", maxWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <div style={{ position: "relative" }}>
                    <div style={{
                      position: "absolute", left: 0, top: 0, bottom: 0,
                      width: `${(it.value / max) * 100}%`,
                      background: "rgba(200,16,46,0.08)", zIndex: 0,
                    }} />
                    <span style={{ position: "relative", zIndex: 1 }}>{it.name}</span>
                  </div>
                </td>
                <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 600 }}>{fmt(it.value)}</td>
                {b.showShare && (
                  <td style={{ padding: "4px 6px", textAlign: "right", color: "#64748B" }}>
                    {(it.share * 100).toFixed(1)}%
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const topHead: React.CSSProperties = {
  padding: "5px 6px", fontSize: 11, fontWeight: 700, textAlign: "center",
};

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
