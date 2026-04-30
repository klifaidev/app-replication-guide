import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  variant?: "sku" | "comercial" | "inovacao";
  /** Show selected values as chips below the trigger. */
  showChips?: boolean;
}

export function MultiSelectFilter({
  options,
  selected,
  onChange,
  placeholder = "Todos",
  variant = "sku",
  showChips = false,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);

  const triggerClass =
    variant === "comercial"
      ? "h-9 w-full justify-between border-success/40 bg-success/10 text-xs hover:bg-success/15"
      : variant === "inovacao"
        ? "h-9 w-full justify-between border-accent/50 bg-accent/10 text-xs hover:bg-accent/15"
        : "h-9 w-full justify-between border-border/50 bg-secondary/40 text-xs";

  const toggle = (v: string) => {
    if (selected.includes(v)) onChange(selected.filter((s) => s !== v));
    else onChange([...selected, v]);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const triggerText = (() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const opt = options.find((o) => o.value === selected[0]);
      return opt?.label ?? selected[0];
    }
    return `${selected.length} selecionados`;
  })();

  const labelFor = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v;

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            size="sm"
            className={cn(triggerClass, selected.length === 0 && "text-muted-foreground")}
          >
            <span className="truncate">{triggerText}</span>
            <span className="ml-2 inline-flex items-center gap-1">
              {selected.length > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={clear}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") clear(e as unknown as React.MouseEvent);
                  }}
                  className="rounded p-0.5 opacity-60 hover:bg-background/50 hover:opacity-100"
                  aria-label="Limpar seleção"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar…" className="h-9" />
            <CommandList>
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const checked = selected.includes(o.value);
                  return (
                    <CommandItem
                      key={o.value}
                      value={o.label}
                      onSelect={() => toggle(o.value)}
                      className="text-xs"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-3.5 w-3.5",
                          checked ? "opacity-100 text-primary" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{o.label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {showChips && selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((v) => (
            <Badge
              key={v}
              variant="outline"
              className="border-border/50 bg-secondary/40 text-[10px] font-normal"
            >
              <span className="max-w-[180px] truncate">{labelFor(v)}</span>
              <button
                type="button"
                onClick={() => toggle(v)}
                className="ml-1 rounded hover:text-foreground"
                aria-label={`Remover ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
