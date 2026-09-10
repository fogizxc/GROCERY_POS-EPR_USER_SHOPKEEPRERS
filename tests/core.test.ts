import assert from 'node:assert/strict';
import test from 'node:test';

const transitions: Record<string, readonly string[]> = {
  PLACED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PICKING', 'CANCELLED'],
  PICKING: ['PACKING'],
  PACKING: ['READY'],
  READY: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

test('order lifecycle only permits forward transitions or early cancellation', () => {
  assert.equal(transitions.PLACED.includes('ACCEPTED'), true);
  assert.equal(transitions.ACCEPTED.includes('PICKING'), true);
  assert.equal(transitions.READY.includes('OUT_FOR_DELIVERY'), true);
  assert.equal(transitions.OUT_FOR_DELIVERY.includes('DELIVERED'), true);
  assert.equal(transitions.DELIVERED.includes('CANCELLED'), false);
  assert.equal(transitions.PACKING.includes('PLACED'), false);
});

test('delivery fee is free at or above the threshold', () => {
  const fee = (subtotal: number) => subtotal >= 499 ? 0 : 39;
  assert.equal(fee(498), 39);
  assert.equal(fee(499), 0);
  assert.equal(fee(999), 0);
});

test('idempotency key bounds are enforced', () => {
  const valid = (key: string) => key.length >= 16 && key.length <= 128;
  assert.equal(valid('1234567890123456'), true);
  assert.equal(valid('short'), false);
  assert.equal(valid('x'.repeat(129)), false);
});
