import { RecurringTransactionsTable } from "@/components/tables/RecurringTransactionsTable";

export default function RecurringPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Recurring</h1>
        <p className="text-sm text-muted-foreground">
          Track and automate scheduled income and expenses.
        </p>
      </div>
      <RecurringTransactionsTable />
    </div>
  );
}
