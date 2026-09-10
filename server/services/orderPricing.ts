export const FREE_DELIVERY_THRESHOLD = 499;
export const STANDARD_DELIVERY_FEE = 39;

export function calculateDeliveryFee(subtotal: number): number {
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new Error('Invalid subtotal');
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
}

export function calculateOrderTotal(subtotal: number): { deliveryFee: number; total: number } {
  const deliveryFee = calculateDeliveryFee(subtotal);
  return { deliveryFee, total: subtotal + deliveryFee };
}
