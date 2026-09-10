import type { OrderStatus } from '../models/domain';

export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKING'],
  PACKING: ['READY'],
  READY: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || ORDER_TRANSITIONS[from].includes(to);
}
