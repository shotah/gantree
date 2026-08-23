export async function yardFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: "same-origin", ...init });
  if (res.status === 401 && typeof window !== "undefined") {
    let setup = false;
    try {
      const body = (await res.clone().json()) as { setup?: boolean };
      setup = Boolean(body.setup);
    } catch {
      /* ignore */
    }
    window.location.replace(setup ? "/setup" : "/login");
  }
  return res;
}
