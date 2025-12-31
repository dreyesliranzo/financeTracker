"use client";

import { Wifi, WifiOff, RefreshCcw } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSyncStatus } from "@/components/providers/RealtimeProvider";
import { cn } from "@/lib/utils";

const statusConfig = {
  connected: {
    label: "Connected",
    icon: Wifi,
    className: "text-emerald-400"
  },
  reconnecting: {
    label: "Reconnecting",
    icon: Wifi,
    className: "text-amber-400"
  },
  offline: {
    label: "Offline",
    icon: WifiOff,
    className: "text-rose-400"
  }
} as const;

export function SyncStatus() {
  const { status, lastSync, retry } = useSyncStatus();
  const config = statusConfig[status];
  const Icon = config.icon;
  const lastSyncText = lastSync ? new Date(lastSync).toLocaleTimeString() : "N/A";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs transition hover:border-border focus:outline-none focus:ring-2 focus:ring-ring">
          <Icon className={cn("h-3.5 w-3.5", config.className)} />
          <span className="text-muted-foreground">{config.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 space-y-2 p-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-foreground text-sm">Sync status</p>
          <span className="text-xs text-muted-foreground">{config.label}</span>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/40 p-2 text-xs text-muted-foreground">
          <p>Last sync: {lastSyncText}</p>
          <p className="mt-1">State: {config.label}</p>
        </div>
        <button
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border/60 bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
          onClick={retry}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Retry
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
