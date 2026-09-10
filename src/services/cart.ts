export type CartState = Record<string, number>;

const STORAGE_KEY = 'freshcart_cart';
const EVENT_NAME = 'freshcart:cart-updated';

export function loadCart(): CartState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => Number.isInteger(value) && Number(value) > 0).map(([id, value]) => [id, Number(value)]));
  } catch {
    return {};
  }
}

export function saveCart(cart: CartState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: cart }));
}

export function addItemsToCart(items: { productId: string; quantity: number }[]) {
  const next = loadCart();
  for (const item of items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) continue;
    next[item.productId] = (next[item.productId] ?? 0) + item.quantity;
  }
  saveCart(next);
  return next;
}

export function cartUpdatedEventName() {
  return EVENT_NAME;
}
