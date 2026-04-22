import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePricing } from "@/store/pricing";
import { uniqueValues, applyFilters } from "@/lib/analytics";
import type { FilterKey, PricingRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const FIELDS: { key: FilterKey; label: string }[] = [
  { key: "marca", label: "Marca" },
  { key: "canal", label: "Canal" },
  { key: "categoria", label: "Categoria" },
  { key: "subcategoria", label: "Subcategoria" },
  { key: "sku", label: "SKU" },
  { key: "regiao", label: "Região" },
  { key: "mercado", label: "Mercado" },
  { key: "sabor", label: "Sabor" },
  { key: "tecnologia", label: "Tecnologia" },
  { key: "faixaPeso", label: "Faixa de Peso" },
];

export function FilterGrid() {
  const rows = usePricing((s) => s.rows);
  const filters = usePricing((s) => s.filters);
  const setFilter = usePricing((s) => s.setFilter);
  const clear = usePricing((s) => s.clearFilters);
  const selected = usePricing((s) => s.selectedPeriods);

  const baseRows = applyFilters(rows, {}, selected);

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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {FIELDS.map((f) => {
          const opts = uniqueValues(baseRows, f.key as keyof PricingRow);
          if (opts.length === 0) return null;
          const current = filters[f.key]?.[0] ?? "__all__";
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
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__all__">Todos</SelectItem>
                  {opts.map((o) => (
                    <SelectItem key={o} value={o} className="text-xs">
                      {o}
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
