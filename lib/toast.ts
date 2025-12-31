"use client";

import { toast } from "sonner";
import { SuccessToast } from "@/components/ui/SuccessToast";

export function showSuccessToast(title: string, description?: string) {
  toast.custom(
    (id) => (
      <div role="button" tabIndex={0} onClick={() => toast.dismiss(id)}>
        <SuccessToast title={title} description={description} />
      </div>
    ),
    {
      duration: 2200
    }
  );
}
