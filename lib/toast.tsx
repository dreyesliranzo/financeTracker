"use client";

export function showSuccessToast(title: string, description?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("app:success-overlay", {
      detail: { title, description }
    })
  );
}
