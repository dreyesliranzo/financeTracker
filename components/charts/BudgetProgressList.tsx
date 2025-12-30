import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/money";

export type BudgetProgressItem = {
  category: string;
  spent: number;
  limit: number;
};

export function BudgetProgressList({ items }: { items: BudgetProgressItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const ratio = item.limit > 0 ? item.spent / item.limit : 0;
        const over = ratio >= 1;
        const warning = ratio >= 0.8 && ratio < 1;
        return (
          <div key={item.category} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{item.category}</span>
              <Badge
                variant={over ? "warning" : warning ? "secondary" : "outline"}
              >
                {formatCurrency(item.spent)} / {formatCurrency(item.limit)}
              </Badge>
            </div>
            <div className="h-2 w-full rounded-full bg-muted/40">
              <div
                className={cn(
                  "h-2 rounded-full",
                  over
                    ? "bg-rose-400"
                    : warning
                    ? "bg-amber-400"
                    : "bg-emerald-400"
                )}
                style={{ width: `${Math.min(ratio * 100, 100)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
