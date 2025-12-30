import { TransactionsTable } from "@/components/tables/TransactionsTable";

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Search, filter, and manage every entry.
        </p>
      </div>
      <TransactionsTable />
    </div>
  );
}
