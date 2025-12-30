"use client";

import * as React from "react";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";

export function Toaster({ ...props }: React.ComponentProps<typeof Sonner>) {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme as "light" | "dark" | "system"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border/60",
          description: "group-[.toast]:text-muted-foreground"
        }
      }}
      {...props}
    />
  );
}
