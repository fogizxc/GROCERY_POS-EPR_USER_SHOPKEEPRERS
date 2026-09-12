import { useEffect, useState } from 'react';
import { ClipboardList, Gift, MapPin, X } from 'lucide-react';
import { api, type ApiProduct, type ApiShop, type Role } from '../services/api';

type Props = { role: Role; shopId?: string; flash?: (message: string) => void };

export function PlatformTools({ role, shopId, flash }: Props) {
  const [open, setOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [reward, setReward] = useState<{ points: number; spent: number; orders: number } | null>(null);
  const [audit, setAudit] = useState<any[]>([]);

  useEffect(() => {
    if (role === 'customer') void api.rewards().then(setReward).catch(() => setReward(null));
    if (role === 'admin' || role === 'super_admin') void api.auditLogs().then(setAudit).catch(() => setAudit([]));
  }, [role, open]);

  if (role === 'customer') {
    return (
      <>
        <button onClick={() => setOpen(true)} className="fixed bottom-5 left-5 z-40 rounded-2xl bg-[#173d2e] px-4 py-3 text-xs font-extrabold text-white shadow-xl">FreshCart Tools</button>
        {open && <Modal title="Rewards & pickup" close={() => setOpen(false)}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-[#eef5e8] p-5">
              <Gift className="text-[#3e7358]" />
              <div className="mt-3 text-2xl font-extrabold text-[#173d2e]">{reward?.points ?? 0} pts</div>
              <div className="mt-1 text-xs text-[#6f7e76]">{reward?.orders ?? 0} completed orders • ₹{Math.round(reward?.spent ?? 0).toLocaleString('en-IN')} spent</div>
            </div>
            <button onClick={() => { setOpen(false); setPickupOpen(true); }} className="rounded-3xl bg-[#173d2e] p-5 text-left text-white">
              <MapPin />
              <div className="mt-3 text-lg font-extrabold">Self pickup</div>
              <div className="mt-1 text-xs text-white/70">Choose a shop and reserve available stock.</div>
            </button>
          </div>
        </Modal>}
        {pickupOpen && <PickupModal close={() => setPickupOpen(false)} flash={flash} />}
      </>
    );
  }

  if (role === 'shopkeeper' || role === 'store_manager') {
    return <button onClick={() => flash?.(shopId ? `Shop settings available for ${shopId}` : 'No shop is assigned to this account')} className="fixed bottom-5 left-5 z-40 rounded-2xl bg-[#173d2e] px-4 py-3 text-xs font-extrabold text-white shadow-xl">Shop Settings</button>;
  }

  if (role === 'admin' || role === 'super_admin') {
    return (
      <>
        <button onClick={() => setOpen(true)} className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-2xl bg-[#173d2e] px-4 py-3 text-xs font-extrabold text-white shadow-xl"><ClipboardList size={15} />Audit trail</button>
        {open && <Modal title="Real audit trail" close={() => setOpen(false)}>
          <div className="space-y-2">{audit.length ? audit.map((item) => <div key={item.id} className="rounded-2xl bg-[#f5f7f2] p-3 text-xs"><b>{item.action}</b><span className="mx-2 text-[#89958e]">{item.entity}{item.entityId ? `/${item.entityId}` : ''}</span></div>) : <div className="p-8 text-center text-sm text-[#7a8880]">No audit events yet.</div>}</div>
        </Modal>}
      </>
    );
  }

  return null;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-[28px] bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-xl font-extrabold text-[#173d2e]">{title}</h3><button onClick={close}><X /></button></div><div className="mt-5">{children}</div></div></div>;
}

function PickupModal({ close, flash }: { close: () => void; flash?: (message: string) => void }) {
  const [shops, setShops] = useState<ApiShop[]>([]);
  const [query, setQuery] = useState('');
  const [shop, setShop] = useState<ApiShop | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState<'PAY_AT_SHOP' | 'UPI' | 'CARD'>('PAY_AT_SHOP');

  useEffect(() => { if (shop) void api.pickupProducts(shop.id).then(setProducts).catch(() => setProducts([])); }, [shop]);
  const items = Object.entries(cart).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity }));
  const total = items.reduce((sum, item) => sum + (products.find((product) => product.id === item.productId)?.sellingPrice ?? 0) * item.quantity, 0);
  const place = () => {
    if (!shop || !items.length) return;
    setSaving(true);
    void api.createPickupOrder({ shopId: shop.id, items, paymentMethod: payment }).then((order) => { flash?.(`Pickup order ${order.id} created. Code: ${order.pickupCode ?? 'shown in Orders'}`); close(); }).catch((error) => flash?.(error instanceof Error ? error.message : 'Pickup order failed')).finally(() => setSaving(false));
  };

  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"><div className="max-h-[88vh] w-full max-w-3xl overflow-auto rounded-[28px] bg-white p-5"><div className="flex justify-between"><h3 className="text-xl font-extrabold text-[#173d2e]">Self pickup</h3><button onClick={close}><X /></button></div>{!shop ? <><div className="mt-4 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search shop name" className="flex-1 rounded-xl border p-3" /><button onClick={() => void api.pickupShops(query).then(setShops).catch(() => setShops([]))} className="rounded-xl bg-[#173d2e] px-4 text-white">Search</button></div><div className="mt-4 grid gap-2">{shops.map((item) => <button key={item.id} onClick={() => setShop(item)} className="rounded-2xl bg-[#f5f7f2] p-4 text-left"><b>{item.name}</b><div className="text-xs text-[#74827b]">{item.address}</div></button>)}</div></> : <><div className="mt-4 rounded-2xl bg-[#eef5e8] p-4"><b>{shop.name}</b><div className="text-xs">{shop.address}</div></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{products.map((product) => <div key={product.id} className="flex items-center justify-between rounded-2xl bg-[#f5f7f2] p-3"><div><b className="text-xs">{product.name}</b><div className="text-xs">₹{product.sellingPrice} • {product.stock} available</div></div><input min="0" max={product.stock} type="number" value={cart[product.id] ?? 0} onChange={(event) => setCart((current) => ({ ...current, [product.id]: Math.min(product.stock, Math.max(0, Number(event.target.value) || 0)) }))} className="w-20 rounded-xl border p-2" /></div>)}</div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><select value={payment} onChange={(event) => setPayment(event.target.value as typeof payment)} className="rounded-xl border p-3 text-sm"><option value="PAY_AT_SHOP">Pay at shop</option><option value="UPI">UPI</option><option value="CARD">Card</option></select><b>Total ₹{Math.round(total)}</b><button disabled={saving || !items.length} onClick={place} className="rounded-xl bg-[#173d2e] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-40">{saving ? 'Placing…' : 'Reserve pickup'}</button></div></>}</div></div>;
}
