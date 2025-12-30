"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GoalForm } from "@/components/forms/GoalForm";
import { EmptyState } from "@/components/empty/EmptyState";
import { currencyOptions } from "@/lib/money/currencies";
import { formatCurrency } from "@/lib/money";
import { fetchGoals, fetchProfile } from "@/lib/supabase/queries";
import { deleteGoal } from "@/lib/supabase/mutations";

export default function GoalsPage() {
  const queryClient = useQueryClient();
  const [selectedCurrency, setSelectedCurrency] = useState("USD");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile
  });

  const { data: goals = [] } = useQuery({
    queryKey: ["goals", selectedCurrency],
    queryFn: () => fetchGoals(selectedCurrency)
  });

  useEffect(() => {
    if (profile?.default_currency && profile.default_currency !== selectedCurrency) {
      setSelectedCurrency(profile.default_currency);
    }
  }, [profile, selectedCurrency]);

  const sortedGoals = useMemo(() => {
    return [...goals].sort((a, b) => b.target_cents - a.target_cents);
  }, [goals]);

  const handleDelete = async (id: string) => {
    try {
      await deleteGoal(id);
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete goal");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Goals</h1>
          <p className="text-sm text-muted-foreground">
            Track progress toward savings and payoff milestones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {currencyOptions.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  {currency.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Create goal</Button>
            </DialogTrigger>
            <DialogContent>
              <GoalForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {sortedGoals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Set a savings or payoff goal to track progress."
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button>Create goal</Button>
              </DialogTrigger>
              <DialogContent>
                <GoalForm />
              </DialogContent>
            </Dialog>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sortedGoals.map((goal) => {
            const ratio = goal.target_cents
              ? goal.current_cents / goal.target_cents
              : 0;
            return (
              <Card key={goal.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle>{goal.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatCurrency(goal.current_cents, selectedCurrency)} of{" "}
                      {formatCurrency(goal.target_cents, selectedCurrency)}
                    </p>
                    {goal.due_date ? (
                      <p className="text-xs text-muted-foreground">
                        Due {format(parseISO(goal.due_date), "MMM d, yyyy")}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <GoalForm goal={goal} />
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete goal?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(goal.id!)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-2 w-full rounded-full bg-muted/40">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(ratio * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {ratio >= 1 ? "Goal reached" : `${Math.round(ratio * 100)}% saved`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
