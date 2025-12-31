"use client";

import { cn } from "@/lib/utils";

export function LoadingText({
  label = "Loading",
  className
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-xs text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <span className="loading-dot loading-dot-1" />
        <span className="loading-dot loading-dot-2" />
        <span className="loading-dot loading-dot-3" />
      </span>
    </div>
  );
}
