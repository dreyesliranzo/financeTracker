"use client";

import { Wifi, WifiOff } from "lucide-react";
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
  const { status } = useSyncStatus();
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs">
      <Icon className={cn("h-3.5 w-3.5", config.className)} />
      <span className="text-muted-foreground">{config.label}</span>
    </div>
  );
}
