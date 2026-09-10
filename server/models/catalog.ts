export interface Address {
  id: string;
  userId: string;
  label: 'HOME' | 'WORK' | 'OTHER';
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  landmark?: string;
  isDefault: boolean;
}
export interface DeliverySlot { id: string; date: string; label: string; startTime: string; endTime: string; capacity: number; booked: number; active: boolean; }
export interface WishlistItem { userId: string; productId: string; createdAt: string; }
export interface Offer { id: string; code: string; title: string; description: string; discountType: 'PERCENT' | 'FLAT'; discountValue: number; minOrderValue: number; maxDiscount?: number; active: boolean; startsAt: string; endsAt: string; }
export interface Payment {
  id: string;
  orderId: string;
  method: 'UPI' | 'CARD' | 'COD';
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED' | 'CANCELLED';
  amount: number;
  provider?: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  createdAt: string;
}
export interface DeliveryAssignment { id: string; orderId: string; shopId: string; employeeId?: string; status: 'UNASSIGNED' | 'ASSIGNED' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED'; assignedAt?: string; deliveredAt?: string; distanceKm?: number; ratePerKm?: number; earning?: number; }
export interface Notification { id: string; userId: string; title: string; message: string; type: 'ORDER' | 'STOCK' | 'PAYMENT' | 'SYSTEM' | 'OFFER'; read: boolean; createdAt: string; }
export interface Attendance { id: string; userId: string; shopId?: string; date: string; checkIn?: string; checkOut?: string; status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'; }
export interface AuditLog { id: string; actorId: string; actorRole: string; action: string; entity: string; entityId?: string; metadata?: Record<string, unknown>; createdAt: string; }
export interface DeliveryPricing { baseRatePerKm: number; milestoneRatePerKm: number; milestoneDeliveries: number; updatedAt: string; updatedBy: string; }
