/** `?phone` wraps the current page in a 390px frame so media queries fire without DevTools. */
export function phoneFrameSrc(path: string, search = ""): { on: boolean; src: string } {
  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const on = q.has("phone");
  q.delete("phone");
  const rest = q.toString();
  const base = path || "/";
  return { on, src: rest ? `${base}?${rest}` : base };
}
