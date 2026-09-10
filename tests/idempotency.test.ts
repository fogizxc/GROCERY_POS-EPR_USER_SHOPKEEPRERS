import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidIdempotencyKey } from '../server/services/idempotency';

test('idempotency keys are bounded', () => {
  assert.equal(isValidIdempotencyKey('1234567890123456'), true);
  assert.equal(isValidIdempotencyKey('short'), false);
  assert.equal(isValidIdempotencyKey('x'.repeat(129)), false);
});
