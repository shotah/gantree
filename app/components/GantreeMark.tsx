export function GantreeMark({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={className} aria-hidden>
      <g fill="currentColor">
        <rect x="3" y="5" width="26" height="3.5" rx="0.7" />
        <rect x="5" y="8.5" width="3" height="16" rx="0.5" />
        <rect x="24" y="8.5" width="3" height="16" rx="0.5" />
        <rect x="3" y="23.5" width="7" height="2.2" rx="0.4" />
        <rect x="22" y="23.5" width="7" height="2.2" rx="0.4" />
        <rect x="13.5" y="8.5" width="5" height="2.5" rx="0.5" />
        <rect x="15.2" y="11" width="1.6" height="5" rx="0.3" />
        <rect x="11.5" y="16" width="9" height="5.5" rx="1.1" />
      </g>
    </svg>
  );
}
