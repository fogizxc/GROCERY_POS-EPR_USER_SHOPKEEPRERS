const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
export type Role = 'customer' | 'shopkeeper' | 'employee' | 'store_manager' | 'admin' | 'super_admin';
export type PaymentMethod = 'UPI' | 'CARD' | 'COD';
export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PICKING' | 'PACKING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
export type DeliveryStatus = 'ASSIGNED' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED';
export type AddressLabel = 'HOME' | 'WORK' | 'OTHER';
export interface ApiUser { id: string; name: string; email: string; phone: string; role: Role; shopId?: string; active: boolean; }
export interface ApiProduct { id: string; sku: string; name: string; category: string; unit: string; mrp: number; sellingPrice: number; stock: number; minStock: number; shopId?: string; imageUrl?: string; active: boolean; }
export interface ApiOrderItem { productId: string; name: string; quantity: number; unitPrice: number; }
export interface ApiAddress { id: string; userId: string; label: AddressLabel; line1: string; line2?: string; city: string; state: string; postalCode: string; landmark?: string; isDefault: boolean; }
export interface ApiDeliverySlot { id: string; date: string; label: string; startTime: string; endTime: string; capacity: number; booked: number; active: boolean; }
export interface ApiPayment { id: string; orderId: string; method: PaymentMethod; status: string; amount: number; provider?: string; createdAt: string; }
export interface ApiOrder { id: string; customerId: string; shopId: string; items: ApiOrderItem[]; subtotal: number; deliveryFee: number; total: number; paymentMethod: PaymentMethod; status: OrderStatus; createdAt: string; }
export interface ApiShop { id: string; name: string; address: string; active: boolean; }
export interface ApiNotification { id: string; userId: string; title: string; message: string; type: 'ORDER'|'STOCK'|'PAYMENT'|'SYSTEM'|'OFFER'; read: boolean; createdAt: string; }
export interface ApiAttendance { id: string; userId: string; shopId?: string; date: string; checkIn?: string; checkOut?: string; status: 'PRESENT'|'ABSENT'|'HALF_DAY'|'LEAVE'; }
export interface ApiReorder { shopId: string; items: { productId: string; quantity: number }[]; unavailable: string[]; }
export interface ApiOrderTimeline { status: OrderStatus; label: string; timestamp?: string; completed: boolean; current: boolean; }
export interface ApiOrderDetail extends ApiOrder { address: ApiAddress; deliverySlot: ApiDeliverySlot; payment?: ApiPayment; timeline: ApiOrderTimeline[]; }
async function request<T>(path: string, options: RequestInit = {}): Promise<T> { const token = localStorage.getItem('freshcart_token'); const headers = new Headers(options.headers); headers.set('Content-Type','application/json'); if(token) headers.set('Authorization',`Bearer ${token}`); const response = await fetch(`${API_BASE}/api${path}`,{...options,headers}); if(!response.ok){const body=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(body?.error||`Request failed (${response.status})`);} if(response.status===204)return undefined as T; return response.json() as Promise<T>; }
const query=(params?:Record<string,string|undefined>)=>{const entries=Object.entries(params??{}).filter(([,value])=>value) as [string,string][];return entries.length?`?${new URLSearchParams(entries)}`:'';};
export const api={
 login:async(identifier:string,role:Role)=>{const session=await request<{token:string;user:ApiUser;expiresAt:number}>('/auth/login',{method:'POST',body:JSON.stringify({identifier,role})});localStorage.setItem('freshcart_token',session.token);return session;},
 me:()=>request<ApiUser>('/auth/me'), logout:async()=>{await request<void>('/auth/logout',{method:'POST'});localStorage.removeItem('freshcart_token');},
 products:(params?:{shopId?:string;category?:string;q?:string})=>request<ApiProduct[]>(`/products${query(params)}`), shops:()=>request<ApiShop[]>('/shops'),
 addresses:()=>request<ApiAddress[]>('/addresses'), addAddress:(address:Omit<ApiAddress,'id'|'userId'>)=>request<ApiAddress>('/addresses',{method:'POST',body:JSON.stringify(address)}), deliverySlots:()=>request<ApiDeliverySlot[]>('/delivery-slots'),
 orders:(params?:{status?:OrderStatus;shopId?:string})=>request<ApiOrder[]>(`/orders${query(params)}`), customerOrders:()=>request<ApiOrder[]>('/customer/orders'), customerOrder:(id:string)=>request<ApiOrderDetail>(`/customer/orders/${id}`), createOrder:(input:{shopId:string;items:{productId:string;quantity:number}[];paymentMethod:PaymentMethod;addressId:string;deliverySlotId:string})=>request<ApiOrder&{address:ApiAddress;deliverySlot:ApiDeliverySlot;payment:ApiPayment}>('/orders',{method:'POST',body:JSON.stringify(input)}),
 reorder:(orderId:string)=>request<ApiReorder>(`/customer/orders/${orderId}/reorder`,{method:'POST'}),
 updateOrderStatus:(id:string,status:OrderStatus)=>request<ApiOrder>(`/orders/${id}/status`,{method:'PATCH',body:JSON.stringify({status})}), updateStock:(id:string,stock:number)=>request<ApiProduct>(`/products/${id}/stock`,{method:'PATCH',body:JSON.stringify({stock})}),
 deliveryQueue:()=>request<ApiOrder[]>('/delivery/queue'), deliveryEmployees:()=>request<ApiUser[]>('/delivery/employees'), assignDelivery:(orderId:string,employeeId:string)=>request<{order:ApiOrder}>(`/delivery/orders/${orderId}/assign`,{method:'POST',body:JSON.stringify({employeeId})}), deliveryStatus:(orderId:string,status:DeliveryStatus)=>request<ApiOrder>(`/delivery/orders/${orderId}/status`,{method:'PATCH',body:JSON.stringify({status})}),
 notifications:()=>request<ApiNotification[]>('/ops/notifications'), markNotificationRead:(id:string)=>request<ApiNotification>(`/ops/notifications/${id}/read`,{method:'PATCH'}), attendance:(params?:{userId?:string;from?:string;to?:string})=>request<ApiAttendance[]>(`/ops/attendance${query(params)}`), checkIn:()=>request<ApiAttendance>('/ops/attendance/check-in',{method:'POST'}), checkOut:()=>request<ApiAttendance>('/ops/attendance/check-out',{method:'POST'}),
 adminDashboard:()=>request<{revenue:number;activeOrders:number;products:number;lowStock:number;shops:number;staff:number}>('/admin/dashboard'), adminProducts:()=>request<ApiProduct[]>('/admin/products'), adminShops:()=>request<ApiShop[]>('/admin/shops'), adminStaff:()=>request<ApiUser[]>('/admin/staff'), adminOrders:()=>request<ApiOrder[]>('/admin/orders'),
};
