/** `?phone` wraps the current page in a device frame so media queries fire without DevTools. Off unless `dev` (same gate as auth auto-login). */

export type PhonePreset = {
  id: "android-small" | "iphone-se" | "iphone" | "android" | "iphone-max";
  label: string;
  width: number;
  height: number;
};

/** CSS viewports (logical px). Compact Android → iPhone Max. */
export const PHONE_PRESETS: readonly PhonePreset[] = [
  { id: "android-small", label: "Android small", width: 360, height: 800 },
  { id: "iphone-se", label: "iPhone SE", width: 375, height: 667 },
  { id: "iphone", label: "iPhone", width: 390, height: 844 },
  { id: "android", label: "Android", width: 412, height: 915 },
  { id: "iphone-max", label: "iPhone Max", width: 430, height: 932 },
];

export const DEFAULT_PHONE_PRESET: PhonePreset = PHONE_PRESETS.find((p) => p.id === "iphone") ?? PHONE_PRESETS[0];

export function phonePreset(raw: string | null): PhonePreset {
  if (raw == null || raw === "" || raw === "1" || raw === "true" || raw === "on") {
    return DEFAULT_PHONE_PRESET;
  }
  return PHONE_PRESETS.find((p) => p.id === raw) ?? DEFAULT_PHONE_PRESET;
}

export function phonePreviewHref(path: string, search: string, id: PhonePreset["id"]): string {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  q.set("phone", id);
  const rest = q.toString();
  const base = path || "/";
  return rest ? `${base}?${rest}` : base;
}

export function phoneFrameSrc(
  path: string,
  search = "",
  dev = false,
): { on: boolean; src: string; preset: PhonePreset } {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const on = dev && q.has("phone");
  const preset = phonePreset(q.get("phone"));
  q.delete("phone");
  const rest = q.toString();
  const base = path || "/";
  return { on, src: rest ? `${base}?${rest}` : base, preset };
}
