function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function OperatorAvatar({
  id,
  rev,
  name,
  size = "sm",
}: {
  id: string;
  rev: number | null;
  name: string;
  size?: "sm" | "lg" | "xl";
}) {
  const dim = size === "xl" ? "h-24 w-24" : size === "lg" ? "h-12 w-12" : "h-8 w-8";
  const fallback = size === "xl" ? "text-2xl" : size === "lg" ? "text-sm" : "text-[11px]";
  if (rev == null) {
    return (
      <span
        className={`inline-flex ${dim} ${fallback} shrink-0 items-center justify-center rounded-full bg-track font-medium text-body`}
        aria-hidden
      >
        {initials(name)}
      </span>
    );
  }
  return (
    <img
      src={`/api/operators/${encodeURIComponent(id)}/avatar?v=${rev}`}
      alt=""
      className={`${dim} shrink-0 rounded-full object-cover`}
    />
  );
}
