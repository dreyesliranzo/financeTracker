"use client";

import { useEffect, useRef, useState } from "react";
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
      hideTimer.current = window.setTimeout(() => setVisible(false), 1600);
      clearTimer.current = window.setTimeout(() => setPayload(null), 2100);
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
        <div className="success-hero">
          <div className="success-hero-ring" aria-hidden="true">
            <svg className="success-hero-svg" viewBox="0 0 120 120">
              <circle className="success-hero-circle" cx="60" cy="60" r="46" />
              <path className="success-hero-check" d="M36 62l16 16 32-34" />
            </svg>
          </div>
          <div className="success-hero-text">
            <p className="success-hero-title">{payload.title}</p>
            {payload.description ? (
              <p className="success-hero-description">{payload.description}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
