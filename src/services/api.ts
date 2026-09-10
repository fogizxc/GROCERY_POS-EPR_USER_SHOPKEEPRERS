const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export type Role = 'customer' | 'shopkeeper' | 'employee' | 'store_manager' | 'admin' | 'super_admin';
export type PaymentMethod = 'UPI' | 'CARD' | 'COD';
export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PICKING' | 'PACKING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface ApiUser { id: string; name: string; email: string; phone: string; role: Role; shopId?: string; active: boolean; }
export interface ApiProduct { id: string; sku: string; name: string; category: string; unit: string; mrp: number; sellingPrice: number; stock: number; minStock: number; shopId?: string; imageUrl?: string; active: boolean; }
export interface ApiOrderItem { productId: string; name: string; quantity: number; unitPrice: number; }
export interface ApiOrder { id: string; customerId: string; shopId: string; items: ApiOrderItem[]; subtotal: number; deliveryFee: number; total: number; paymentMethod: PaymentMethod; status: OrderStatus; createdAt: string; }
export interface ApiShop { id: string; name: string; address: string; active: boolean; }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('freshcart_token');
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  login: (identifier: string, role: Role) => request<{ token: string; user: ApiUser; expiresAt: number }>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier, role }) }),
  me: () => request<ApiUser>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  products: (params?: { shopId?: string; category?: string; q?: string }) => request<ApiProduct[]>(`/products?${new URLSearchParams(params as Record<string, string>)}`),
  shops: () => request<ApiShop[]>('/shops'),
  orders: (params?: { status?: OrderStatus; shopId?: string }) => request<ApiOrder[]>(`/orders?${new URLSearchParams(params as Record<string, string>)}`),
  createOrder: (shopId: string, items: { productId: string; quantity: number }[], paymentMethod: PaymentMethod) => request<ApiOrder>('/orders', { method: 'POST', body: JSON.stringify({ shopId, items, paymentMethod }) }),
  updateOrderStatus: (id: string, status: OrderStatus) => request<ApiOrder>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateStock: (id: string, stock: number) => request<ApiProduct>(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ stock }) }),
  deliveryQueue: () => request<ApiOrder[]>('/delivery/queue'),
  assignDelivery: (orderId: string, employeeId: string) => request<{ order: ApiOrder }>(`/delivery/orders/${orderId}/assign`, { method: 'POST', body: JSON.stringify({ employeeId }) }),
};
