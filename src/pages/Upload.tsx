import { Topbar } from "@/components/pricing/Topbar";
import { GlassCard } from "@/components/pricing/GlassCard";
import { UploadZone } from "@/components/pricing/UploadZone";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePricing } from "@/store/pricing";
import { Trash2, FileSpreadsheet, Calendar } from "lucide-react";

const EXPECTED_COLS = [
  "Periodo (ex.: 005.2025)",
  "Marca, Canal, Categoria, Subcategoria",
  "SKU, Descrição SKU, Cliente",
  "Região, Mercado, Sabor, Tecnologia, Faixa de Peso",
  "ROL (Receita Op. Líquida)",
  "Volume (kg), CMV / Custo",
  "Margem Bruta, Contribuição Marginal",
];

export default function Upload() {
  const files = usePricing((s) => s.files);
  const removeFile = usePricing((s) => s.removeFile);
  const clearAll = usePricing((s) => s.clearAll);
  const months = useMonthsInfo();

  return (
    <>
      <Topbar title="Upload / Bases" subtitle="Gerencie os arquivos e meses carregados" />
      <div className="space-y-6 px-8 py-6">
        <GlassCard>
          <UploadZone />
        </GlassCard>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <GlassCard>
            <header className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                <Calendar className="mr-2 inline h-4 w-4" /> Meses carregados
              </h3>
              <Badge variant="secondary">{months.length}</Badge>
            </header>
            {months.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum mês carregado.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {months.map((m) => (
                  <div key={m.periodo} className="rounded-lg border border-border/40 bg-secondary/30 p-3 text-center">
                    <div className="text-sm font-semibold">{m.label}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{m.fy}</div>
                    <div className="mt-1 text-[10px] text-muted-foreground">{m.rowCount.toLocaleString("pt-BR")} linhas</div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard>
            <header className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium">
                <FileSpreadsheet className="mr-2 inline h-4 w-4" /> Arquivos
              </h3>
              {files.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={clearAll}>
                  Limpar tudo
                </Button>
              )}
            </header>
            {files.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum arquivo carregado.</p>
            ) : (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={f.name} className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{f.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {f.rowCount.toLocaleString("pt-BR")} linhas · {f.months.length} mês(es)
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeFile(f.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>

        <GlassCard>
          <h3 className="mb-3 text-sm font-medium">Colunas esperadas no CSV</h3>
          <ul className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground md:grid-cols-2">
            {EXPECTED_COLS.map((c) => (
              <li key={c} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Aceita separadores “;” ou “,”, decimais BR (1.234,56) ou internacional (1234.56).
            Linhas com ROL ≤ 0 são descartadas.
          </p>
        </GlassCard>
      </div>
    </>
  );
}
