const authHeaders = () => {
  const headers = new Headers();
  const token = localStorage.getItem('freshcart_token');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
};

const readError = async (response: Response) => {
  const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  return body?.error || body?.message || `Request failed (${response.status})`;
};

export async function shopkeeperProducts<T = unknown>() {
  const r = await fetch('/api/shopkeeper/products', { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<T>;
}

export async function shopkeeperStock<T = unknown>(id: string, stock: number) {
  const headers = authHeaders();
  headers.set('Content-Type', 'application/json');
  const r = await fetch(`/api/shopkeeper/products/${id}/stock`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ stock }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<T>;
}

export async function submitShopkeeperCsv<T = unknown>(fileName: string, csv: string) {
  // Keep CSV submission as JSON for the current API contract, but avoid the
  // generic JSON header helper that was also used for every request. This
  // makes the upload request explicit and easier to diagnose in production.
  const headers = authHeaders();
  headers.set('Content-Type', 'application/json');
  const r = await fetch('/api/onboarding/sales-imports', {
    method: 'POST',
    headers,
    body: JSON.stringify({ fileName, csv }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<T>;
}

export async function adminSalesImports<T = unknown>() {
  const r = await fetch('/api/admin/sales-imports', { headers: authHeaders() });
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<T>;
}

export async function adminApproveCsv<T = unknown>(referenceId: string) {
  const headers = authHeaders();
  const r = await fetch(`/api/admin/sales-imports/${encodeURIComponent(referenceId)}/approve`, {
    method: 'POST',
    headers,
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<T>;
}

export async function adminRejectCsv<T = unknown>(referenceId: string, reason: string) {
  const headers = authHeaders();
  headers.set('Content-Type', 'application/json');
  const r = await fetch(`/api/admin/sales-imports/${encodeURIComponent(referenceId)}/reject`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ reason }),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json() as Promise<T>;
}
