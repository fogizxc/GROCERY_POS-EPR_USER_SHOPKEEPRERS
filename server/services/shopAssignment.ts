import { shops } from '../store/memoryStore';

export function assignNearestActiveShop(preferredShopId?: string) {
  if (preferredShopId) {
    const preferred = shops.find(s => s.id === preferredShopId && s.active);
    if (preferred) return preferred;
  }
  return shops.find(s => s.active) ?? null;
}
