export function GantreeMark({
  className,
  tiled = false,
}: {
  className?: string;
  tiled?: boolean;
}) {
  if (tiled) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className={className} aria-hidden>
        <rect width="64" height="64" rx="14" fill="var(--canvas)" />
        <g fill="var(--accent)">
          <rect x="8" y="12" width="48" height="7" rx="1.5" />
          <rect x="10" y="14" width="44" height="2" rx="1" fill="var(--mark)" />
          <rect x="12" y="19" width="6" height="30" rx="1" />
          <rect x="46" y="19" width="6" height="30" rx="1" />
          <rect x="8" y="47" width="14" height="4" rx="1" />
          <rect x="42" y="47" width="14" height="4" rx="1" />
          <rect x="27" y="19" width="10" height="5" rx="1" />
          <rect x="30.5" y="24" width="3" height="9" rx="0.5" />
          <rect x="23" y="33" width="18" height="11" rx="2.5" />
        </g>
        <circle cx="28" cy="38.5" r="1.7" fill="var(--ok)" />
      </svg>
    );
  }
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
