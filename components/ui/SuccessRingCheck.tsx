export function SuccessRingCheck() {
  return (
    <div className="success-ring">
      <svg className="success-ring-svg" viewBox="0 0 48 48" aria-hidden="true">
        <circle className="success-ring-circle" cx="24" cy="24" r="18" />
        <path className="success-ring-check" d="M15 24l6 6 12-14" />
      </svg>
    </div>
  );
}
