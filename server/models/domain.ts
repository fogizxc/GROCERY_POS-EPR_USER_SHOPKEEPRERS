export type Role = 'customer' | 'shopkeeper' | 'employee' | 'store_manager' | 'admin' | 'super_admin';
export type OrderStatus = 'PLACED' | 'ACCEPTED' | 'PICKING' | 'PACKING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'COLLECTED';
export type OrderFulfilment = 'DELIVERY' | 'SELF_PICKUP';
export type OrderPaymentMethod = 'UPI' | 'CARD' | 'COD' | 'PAY_AT_SHOP';
export interface User { id:string; name:string; email:string; phone:string; username?:string; role:Role; shopId?:string; active:boolean; passwordHash?:string; }
export interface Product { id:string; sku:string; barcode?:string; name:string; category:string; unit:string; mrp:number; sellingPrice:number; costPrice?:number; stock:number; minStock:number; shopId?:string; imageUrl?:string; active:boolean; }
export interface OrderItem { productId:string; name:string; quantity:number; unitPrice:number; }
export interface Order { id:string; customerId:string; shopId:string; items:OrderItem[]; subtotal:number; deliveryFee:number; total:number; paymentMethod:OrderPaymentMethod; fulfilment:OrderFulfilment; status:OrderStatus; createdAt:string; addressId?:string; deliverySlotId?:string; pickupCode?:string; pickupConfirmedAt?:string; idempotencyKey?:string; couponCode?:string; discount?:number; }
export interface Shop { id:string; name:string; address:string; active:boolean; }
export interface SalesImport { referenceId:string; shopId:string; fileName:string; csv:string; rowCount:number; status:'PENDING_REVIEW'|'APPROVED'|'REJECTED'; submittedBy:string; submittedAt:string; reviewedBy?:string; reviewedAt?:string; rejectionReason?:string; }
