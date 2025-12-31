"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ChecklistItem = {
  label: string;
  done: boolean;
  action?: ReactNode;
};

const storageKey = "ledgerly:onboarding-dismissed";

export function OnboardingChecklist({
  title,
  description,
  items
}: {
  title: string;
  description: string;
  items: ChecklistItem[];
}) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(storageKey) === "true");
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, "true");
    }
  };

  if (dismissed) return null;

  return (
    <Card className="space-y-4 border-dashed border-border/60 bg-muted/20 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          Dismiss
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <CheckCircle2
              className={`h-4 w-4 ${item.done ? "text-emerald-400" : "text-muted-foreground"}`}
            />
            <div className="flex-1">
              <p className={`text-sm ${item.done ? "text-foreground" : "text-muted-foreground"}`}>
                {item.label}
              </p>
            </div>
            {item.action ? <div>{item.action}</div> : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
