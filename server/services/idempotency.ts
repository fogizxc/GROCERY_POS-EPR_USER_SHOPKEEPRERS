export const IDEMPOTENCY_KEY_MIN = 16;
export const IDEMPOTENCY_KEY_MAX = 128;

export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && value.length >= IDEMPOTENCY_KEY_MIN && value.length <= IDEMPOTENCY_KEY_MAX;
}
