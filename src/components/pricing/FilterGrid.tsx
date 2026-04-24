import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePricing } from "@/store/pricing";
import { uniqueValues, applyFilters } from "@/lib/analytics";
import type { FilterKey, PricingRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getDeParaBySku } from "@/lib/depara";

// Apenas as colunas existentes na planilha De Para IA.
const FIELDS: { key: FilterKey; label: string }[] = [
  { key: "categoria", label: "01. Categoria" },
  { key: "marca", label: "02. Marca" },
  { key: "tecnologia", label: "03. Tecnologia" },
  { key: "subcategoria", label: "04. Formato" },
  { key: "mercado", label: "05. Mercado" },
  { key: "faixaPeso", label: "06. Faixa de Peso" },
  { key: "sabor", label: "07. Sabor" },
  { key: "sku", label: "Artigo (SKU)" },
];

export function FilterGrid() {
  const rows = usePricing((s) => s.rows);
  const filters = usePricing((s) => s.filters);
  const setFilter = usePricing((s) => s.setFilter);
  const clear = usePricing((s) => s.clearFilters);
  const selected = usePricing((s) => s.selectedPeriods);

  // Considera apenas linhas cujo SKU está no De Para — assim os valores
  // exibidos em cada filtro vêm exclusivamente da planilha De Para IA.
  const baseRows = applyFilters(rows, {}, selected).filter((r) =>
    getDeParaBySku(r.sku),
  );

  const hasAny = Object.values(filters).some((v) => v && v.length);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Filtros</h3>
        {hasAny && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={clear}>
            <X className="mr-1 h-3 w-3" /> Limpar
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {FIELDS.map((f) => {
          const opts = uniqueValues(baseRows, f.key as keyof PricingRow);
          if (opts.length === 0) return null;
          const current = filters[f.key]?.[0] ?? "__all__";

          // For SKU, build "SKU - NOME ITEM" labels using skuDesc from rows
          let optionItems: { value: string; label: string }[];
          if (f.key === "sku") {
            const descBySku = new Map<string, string>();
            for (const r of baseRows) {
              if (r.sku && r.skuDesc && !descBySku.has(r.sku)) {
                descBySku.set(r.sku, r.skuDesc);
              }
            }
            optionItems = opts
              .map((o) => {
                const desc = descBySku.get(o);
                return { value: o, label: desc ? `${o} - ${desc}` : o };
              })
              .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
          } else {
            optionItems = opts.map((o) => ({ value: o, label: o }));
          }

          // Custom display for selected SKU value in trigger
          const triggerDisplay =
            f.key === "sku" && current !== "__all__"
              ? optionItems.find((o) => o.value === current)?.label
              : undefined;

          return (
            <div key={f.key}>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {f.label}
              </label>
              <Select
                value={current}
                onValueChange={(v) => setFilter(f.key, v === "__all__" ? [] : [v])}
              >
                <SelectTrigger className="h-9 border-border/50 bg-secondary/40 text-xs">
                  {triggerDisplay ? (
                    <span className="truncate">{triggerDisplay}</span>
                  ) : (
                    <SelectValue placeholder="Todos" />
                  )}
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__all__">Todos</SelectItem>
                  {optionItems.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
