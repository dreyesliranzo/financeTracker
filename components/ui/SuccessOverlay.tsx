"use client";

import { useEffect, useRef, useState } from "react";
import { SuccessToast } from "@/components/ui/SuccessToast";

type SuccessPayload = {
  title: string;
  description?: string;
};

const EVENT_NAME = "app:success-overlay";

export function SuccessOverlay() {
  const [payload, setPayload] = useState<SuccessPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const clearTimer = useRef<number | null>(null);

  useEffect(() => {
    const handle = (event: Event) => {
      const detail = (event as CustomEvent<SuccessPayload>).detail;
      if (!detail?.title) return;

      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (clearTimer.current) window.clearTimeout(clearTimer.current);

      setPayload(detail);
      window.requestAnimationFrame(() => setVisible(true));
      hideTimer.current = window.setTimeout(() => setVisible(false), 1500);
      clearTimer.current = window.setTimeout(() => setPayload(null), 1900);
    };

    window.addEventListener(EVENT_NAME, handle as EventListener);
    return () => {
      window.removeEventListener(EVENT_NAME, handle as EventListener);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (clearTimer.current) window.clearTimeout(clearTimer.current);
    };
  }, []);

  if (!payload) return null;

  return (
    <div
      className={`success-overlay ${visible ? "is-visible" : ""}`}
      onClick={() => setVisible(false)}
    >
      <div className="success-overlay-card" onClick={(event) => event.stopPropagation()}>
        <SuccessToast title={payload.title} description={payload.description} />
      </div>
    </div>
  );
}
