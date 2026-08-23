export function CraneAvatar({
  slug,
  rev,
  size = "sm",
}: {
  slug: string;
  rev: number | null;
  size?: "sm" | "lg" | "xl";
}) {
  const dim = size === "xl" ? "h-24 w-24" : size === "lg" ? "h-12 w-12" : "h-8 w-8";
  const fallback = size === "xl" ? "text-2xl" : "text-sm";
  if (rev == null) {
    return (
      <span className={`inline-flex ${dim} ${fallback} shrink-0 items-center justify-center rounded-full bg-zinc-800`} aria-hidden>
        🏗️
      </span>
    );
  }
  return (
    <img
      src={`/api/gantries/${encodeURIComponent(slug)}/avatar?v=${rev}`}
      alt=""
      className={`${dim} shrink-0 rounded-full object-cover`}
    />
  );
}
