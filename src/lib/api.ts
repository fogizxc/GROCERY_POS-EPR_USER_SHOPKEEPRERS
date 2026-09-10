export type ApiUser = { id: string; name: string; email: string; phone: string; role: string; shopId?: string; active: boolean };
export type ApiProduct = { id: string; sku: string; barcode?: string; name: string; category: string; unit: string; mrp: number; sellingPrice: number; stock: number; minStock: number; shopId?: string; imageUrl?: string; active: boolean };
export type ApiOrder = { id: string; customerId: string; shopId: string; items: Array<{ productId: string; name: string; quantity: number; unitPrice: number }>; subtotal: number; deliveryFee: number; total: number; paymentMethod: 'UPI' | 'CARD' | 'COD'; status: string; createdAt: string };

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('freshcart_token');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export const groceryApi = {
  login: async (identifier: string, role: string) => {
    const session = await request<{ token: string; user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, role }) });
    localStorage.setItem('freshcart_token', session.token);
    return session;
  },
  logout: async () => { await request('/auth/logout', { method: 'POST' }); localStorage.removeItem('freshcart_token'); },
  me: () => request<ApiUser>('/auth/me'),
  products: (params: { shopId?: string; category?: string; q?: string } = {}) => request<ApiProduct[]>(`/products?${new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value)) as string[][])}`),
  shops: () => request<Array<{ id: string; name: string; address: string; active: boolean }>>('/shops'),
  orders: (params: { shopId?: string; status?: string } = {}) => request<ApiOrder[]>(`/orders?${new URLSearchParams(Object.entries(params).filter(([, value]) => Boolean(value)) as string[][])}`),
  createOrder: (input: { shopId: string; items: Array<{ productId: string; quantity: number }>; paymentMethod: 'UPI' | 'CARD' | 'COD' }) => request<ApiOrder>('/orders', { method: 'POST', body: JSON.stringify(input) }),
  updateOrderStatus: (id: string, status: string) => request<ApiOrder>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deliveryQueue: () => request<ApiOrder[]>('/delivery/queue'),
  deliveryEmployees: () => request<ApiUser[]>('/delivery/employees'),
  assignDelivery: (orderId: string, employeeId: string) => request(`/delivery/orders/${orderId}/assign`, { method: 'POST', body: JSON.stringify({ employeeId }) }),
};
