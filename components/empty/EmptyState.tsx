import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function EmptyState({
  title,
  description,
  action,
  secondaryAction,
  note
}: {
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  note?: string;
}) {
  return (
    <Card className="flex flex-col items-start gap-2 border-dashed border-border/60 bg-muted/20 p-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {action ? <div>{action}</div> : null}
        {secondaryAction ? <div>{secondaryAction}</div> : null}
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </Card>
  );
}
