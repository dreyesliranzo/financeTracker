import { TransactionsTable } from "@/components/tables/TransactionsTable";
import { RecurringTransactionsTable } from "@/components/tables/RecurringTransactionsTable";
import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Stagger } from "@/components/layout/Stagger";

export default function TransactionsPage() {
  return (
    <Stagger step={70} className="space-y-6">
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
          <Suspense
            fallback={
              <div className="rounded-2xl border border-border/60 bg-card/70 p-6 text-sm text-muted-foreground">
                Loading transactions…
              </div>
            }
          >
            <TransactionsTable />
          </Suspense>
        </TabsContent>
        <TabsContent value="recurring">
          <RecurringTransactionsTable />
        </TabsContent>
      </Tabs>
    </Stagger>
  );
}
