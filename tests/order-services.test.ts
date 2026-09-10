import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateDeliveryFee, calculateOrderTotal } from '../server/services/orderPricing';
import { canTransitionOrder } from '../server/services/orderLifecycle';

test('pricing uses the production delivery threshold', () => {
  assert.equal(calculateDeliveryFee(0), 39);
  assert.equal(calculateDeliveryFee(498), 39);
  assert.equal(calculateDeliveryFee(499), 0);
  assert.deepEqual(calculateOrderTotal(500), { deliveryFee: 0, total: 500 });
});

test('order lifecycle rejects backward and late cancellation', () => {
  assert.equal(canTransitionOrder('PLACED', 'ACCEPTED'), true);
  assert.equal(canTransitionOrder('ACCEPTED', 'PICKING'), true);
  assert.equal(canTransitionOrder('READY', 'OUT_FOR_DELIVERY'), true);
  assert.equal(canTransitionOrder('DELIVERED', 'CANCELLED'), false);
  assert.equal(canTransitionOrder('PACKING', 'PLACED'), false);
});
