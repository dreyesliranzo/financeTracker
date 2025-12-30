"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/AuthProvider";
import { ensureDefaultData } from "@/lib/supabase/bootstrap";
import { materializeRecurringTransactions } from "@/lib/supabase/recurring";

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      lastUserId.current = null;
      return;
    }
    if (lastUserId.current === user.id) return;
    lastUserId.current = user.id;

    ensureDefaultData(user.id)
      .then((didInsert) => {
        if (!didInsert) return;
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["categories"] });
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      })
      .catch((error) => {
        console.error("Bootstrap failed", error);
      });

    materializeRecurringTransactions(user.id)
      .then((result) => {
        if (!result) return;
        if (result.inserted > 0) {
          queryClient.invalidateQueries({ queryKey: ["transactions"] });
        }
        if (result.updated > 0) {
          queryClient.invalidateQueries({ queryKey: ["recurring_transactions"] });
        }
      })
      .catch((error) => {
        console.error("Recurring sync failed", error);
      });
  }, [queryClient, user]);

  return <>{children}</>;
}
