import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  subValue?: string;
  delta?: number; // 0..1 for percent change
  glow?: "blue" | "green" | "red" | "none";
  accent?: "blue" | "green" | "red" | "amber" | "violet";
}

const accentColor: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  blue: "text-primary",
  green: "text-success",
  red: "text-destructive",
  amber: "text-warning",
  violet: "text-accent",
};

export function KpiCard({ label, value, subValue, delta, glow = "none", accent = "blue" }: KpiCardProps) {
  return (
    <GlassCard glow={glow} hoverable className="relative overflow-hidden animate-fade-up">
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <div className={cn("text-4xl font-light tabular-nums", accentColor[accent])}>
          {value}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {subValue && <span>{subValue}</span>}
          {typeof delta === "number" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                delta >= 0
                  ? "bg-success/15 text-success"
                  : "bg-destructive/15 text-destructive",
              )}
            >
              {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta * 100).toFixed(1)}%
            </span>
          )}
        </div>
      </div>
    </GlassCard>
  );
}
