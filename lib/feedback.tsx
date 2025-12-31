"use client";

import { toast } from "sonner";
import { SuccessRingCheck } from "@/components/ui/SuccessRingCheck";

export function successToast(message: string, description?: string) {
  toast.custom((id) => (
    <div
      className="success-toast-card"
      role="status"
      aria-live="polite"
      tabIndex={0}
      onClick={() => toast.dismiss(id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          toast.dismiss(id);
        }
      }}
    >
      <SuccessRingCheck />
      <div className="success-toast-text">
        <p className="success-toast-title">{message}</p>
        {description ? (
          <p className="success-toast-description">{description}</p>
        ) : null}
      </div>
    </div>
  ));
}
