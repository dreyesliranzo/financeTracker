"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers/AuthProvider";
import { ensureDefaultData } from "@/lib/supabase/bootstrap";

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const didRun = useRef(false);

  useEffect(() => {
    if (!user || didRun.current) return;
    didRun.current = true;

    ensureDefaultData(user.id)
      .then((didInsert) => {
        if (!didInsert) return;
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      })
      .catch((error) => {
        console.error("Bootstrap failed", error);
      });
  }, [queryClient, user]);

  return <>{children}</>;
}
