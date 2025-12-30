import { TransactionsTable } from "@/components/tables/TransactionsTable";
import { RecurringTransactionsTable } from "@/components/tables/RecurringTransactionsTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Search, filter, and manage every entry.
        </p>
      </div>
      <Tabs defaultValue="transactions">
        <TabsList>
          <TabsTrigger value="transactions">All transactions</TabsTrigger>
          <TabsTrigger value="recurring">Recurring</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions">
          <TransactionsTable />
        </TabsContent>
        <TabsContent value="recurring">
          <RecurringTransactionsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
