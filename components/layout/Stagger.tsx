"use client";

import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stagger({
  children,
  className,
  step = 50
}: {
  children: ReactNode;
  className?: string;
  step?: number;
}) {
  const items = Children.toArray(children);

  return (
    <div className={cn("ledgerly-stagger", className)}>
      {items.map((child, index) => {
        const key = (child as any)?.key ?? index;
        return (
          <div
            key={key}
            className="ledgerly-stagger-item"
            style={{ ["--d" as any]: `${index * step}ms` }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
