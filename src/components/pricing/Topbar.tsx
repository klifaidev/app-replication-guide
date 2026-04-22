import { Button } from "@/components/ui/button";
import { usePricing } from "@/store/pricing";
import { useMonthsInfo } from "@/store/selectors";
import { cn } from "@/lib/utils";

interface TopbarProps {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const months = useMonthsInfo();
  const selected = usePricing((s) => s.selectedPeriods);
  const togglePeriod = usePricing((s) => s.togglePeriod);
  const setAll = usePricing((s) => s.setAllPeriods);

  const allSelected = selected === null;

  return (
    <header className="sticky top-0 z-20 border-b border-border/40 bg-background/60 px-8 py-4 backdrop-blur-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gradient-primary">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        {months.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={allSelected ? "default" : "outline"}
              className={cn(
                "h-7 rounded-full px-3 text-xs",
                allSelected && "bg-primary/20 text-primary hover:bg-primary/25 border border-primary/30",
              )}
              onClick={() => setAll()}
            >
              Todos
            </Button>
            {months.map((m) => {
              const active = !allSelected && selected!.includes(m.periodo);
              return (
                <Button
                  key={m.periodo}
                  size="sm"
                  variant="outline"
                  className={cn(
                    "h-7 rounded-full border-border/60 bg-secondary/40 px-3 text-xs",
                    active && "border-primary/40 bg-primary/15 text-primary",
                  )}
                  onClick={() => togglePeriod(m.periodo)}
                >
                  {m.label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
