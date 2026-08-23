/** `?phone` wraps the current page in a 390px frame so media queries fire without DevTools. Off unless `dev` (same gate as auth auto-login). */
export function phoneFrameSrc(path: string, search = "", dev = false): { on: boolean; src: string } {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const on = dev && q.has("phone");
  q.delete("phone");
  const rest = q.toString();
  const base = path || "/";
  return { on, src: rest ? `${base}?${rest}` : base };
}
