"use client";

type SuccessToastProps = {
  title: string;
  description?: string;
};

export function SuccessToast({ title, description }: SuccessToastProps) {
  return (
    <div className="success-toast">
      <div className="success-toast-icon" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="success-toast-check"
        >
          <path
            className="success-toast-check-path"
            d="M20 6L9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="success-toast-title">{title}</p>
        {description ? (
          <p className="success-toast-description">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
