import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/money";

export type GoalProgressItem = {
  name: string;
  current: number;
  target: number;
};

export function GoalProgressList({
  items,
  currencyCode = "USD"
}: {
  items: GoalProgressItem[];
  currencyCode?: string;
}) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const ratio = item.target > 0 ? item.current / item.target : 0;
        const reached = ratio >= 1;
        return (
          <div key={item.name} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{item.name}</span>
              <Badge variant={reached ? "secondary" : "outline"}>
                {formatCurrency(item.current, currencyCode)} / {formatCurrency(item.target, currencyCode)}
              </Badge>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/40">
              <div
                className={reached ? "h-2 rounded-full bg-emerald-400" : "h-2 rounded-full bg-primary"}
                style={{ width: `${Math.min(ratio * 100, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
