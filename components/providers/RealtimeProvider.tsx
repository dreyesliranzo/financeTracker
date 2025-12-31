"use client";

import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/AuthProvider";

type SyncStatus = "connected" | "reconnecting" | "offline";

type SyncContextValue = {
  status: SyncStatus;
};

const SyncContext = createContext<SyncContextValue>({ status: "offline" });

const TABLES = [
  "transactions",
  "accounts",
  "categories",
  "budgets",
  "overall_budgets",
  "recurring_transactions",
  "goals"
] as const;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SyncStatus>(
    typeof navigator !== "undefined" && navigator.onLine
      ? "reconnecting"
      : "offline"
  );
  const invalidateTimers = useRef(new Map<string, number>());

  useEffect(() => {
    if (!user) {
      setStatus("offline");
      return;
    }

    const supabase = supabaseBrowser();
    const channel = supabase.channel(`realtime:${user.id}`);

    TABLES.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `user_id=eq.${user.id}`
        },
        () => {
          if (invalidateTimers.current.has(table)) return;
          const timer = window.setTimeout(() => {
            queryClient.invalidateQueries({
              predicate: (query) =>
                Array.isArray(query.queryKey) && query.queryKey[0] === table
            });
            invalidateTimers.current.delete(table);
          }, 300);
          invalidateTimers.current.set(table, timer);
        }
      );
    });

    channel.subscribe((state) => {
      if (state === "SUBSCRIBED") {
        setStatus("connected");
      }
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        setStatus("reconnecting");
      }
      if (state === "CLOSED") {
        setStatus("offline");
      }
    });

    const handleOnline = () => setStatus("reconnecting");
    const handleOffline = () => setStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      invalidateTimers.current.forEach((timer) => window.clearTimeout(timer));
      invalidateTimers.current.clear();
    };
  }, [queryClient, user]);

  const value = useMemo(() => ({ status }), [status]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncStatus() {
  return useContext(SyncContext);
}
