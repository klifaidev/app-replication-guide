import { GlassCard } from "./GlassCard";
import { UploadIcon } from "lucide-react";

export function EmptyState({ message = "Carregue um CSV para começar." }: { message?: string }) {
  return (
    <GlassCard className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <UploadIcon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <h3 className="text-lg font-medium">Sem dados ainda</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      </div>
    </GlassCard>
  );
}
