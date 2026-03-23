export async function apiFetch<T>(
  path: string,
  params?: Record<string, string>,
  init?: RequestInit
): Promise<T> {
  const url = new URL(path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  const headers: Record<string, string> = {};
  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: { ...headers, ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${path} failed: ${res.status} ${body}`);
  }
  return res.json();
}
