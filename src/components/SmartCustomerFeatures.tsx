import { useMemo, useState } from 'react';
import { Award, RotateCcw, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react';
import { api, type ApiOrder, type ApiProduct } from '../services/api';

export function SmartCustomerFeatures({ orders, products, onAdd, flash }: { orders: ApiOrder[]; products: ApiProduct[]; onAdd: (productId: string, quantity?: number) => void; flash: (message: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const completed = orders.filter(o => o.status === 'DELIVERED' || o.status === 'COLLECTED');
  const points = Math.floor(completed.reduce((sum, order) => sum + order.total, 0) / 10);
  const tier = points >= 1000 ? 'Gold' : points >= 500 ? 'Silver' : 'Fresh Starter';
  const nextTier = tier === 'Fresh Starter' ? 500 : tier === 'Silver' ? 1000 : 1500;
  const progress = Math.min(100, Math.round((points / nextTier) * 100));
  const frequent = useMemo(() => {
    const counts = new Map<string, number>();
    completed.forEach(order => order.items.forEach(item => counts.set(item.productId, (counts.get(item.productId) ?? 0) + item.quantity)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, quantity]) => ({ product: products.find(p => p.id === id), quantity })).filter(x => x.product);
  }, [completed, products]);

  const reorderAll = async () => {
    const last = completed[0];
    if (!last) { flash('Place an order first to unlock one-tap reorder.'); return; }
    setBusy(true);
    try {
      const result = await api.reorder(last.id);
      result.items.forEach(item => onAdd(item.productId, item.quantity));
      if (result.unavailable.length) flash(`${result.unavailable.length} item(s) are currently unavailable.`);
      else flash('Your previous basket has been added to the cart.');
    } catch (error) {
      flash(error instanceof Error ? error.message : 'Could not reorder this basket');
    } finally { setBusy(false); }
  };

  return <section className="mx-auto max-w-[1500px] px-4 pb-5 sm:px-6 lg:px-8"><div className="overflow-hidden rounded-[28px] border border-black/5 bg-white shadow-sm"><button onClick={() => setExpanded(v => !v)} className="flex w-full items-center justify-between gap-4 p-5 text-left sm:p-6"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eaf2df] text-[#315d45]"><Sparkles size={20}/></div><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-[#819087]">FreshCart Plus</p><h2 className="mt-1 text-lg font-extrabold text-[#173d2e]">Rewards, insights & one-tap reorder</h2></div></div><span className="rounded-full bg-[#f1f4ef] px-3 py-2 text-[10px] font-extrabold text-[#315245]">{expanded ? 'HIDE' : 'OPEN'}</span></button>{expanded && <div className="grid gap-4 border-t border-black/5 p-5 sm:p-6 lg:grid-cols-3"><div className="rounded-3xl bg-[#173d2e] p-5 text-white"><div className="flex items-center gap-2 text-sm font-extrabold"><Award size={18}/> {tier} member</div><div className="mt-5 text-4xl font-black">{points}</div><div className="mt-1 text-xs text-white/70">reward points</div><div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#d7ef8d]" style={{width:`${progress}%`}}/></div><div className="mt-2 text-[10px] text-white/70">{Math.max(0, nextTier - points)} points to next tier</div></div><div className="rounded-3xl bg-[#f7faf4] p-5"><div className="flex items-center gap-2 text-sm font-extrabold text-[#173d2e]"><RotateCcw size={18}/> Buy again</div><p className="mt-2 text-xs leading-5 text-[#748078]">Rebuild your most recent completed basket using current stock and prices.</p><button disabled={busy || !completed.length} onClick={() => void reorderAll()} className="mt-5 w-full rounded-2xl bg-[#173d2e] px-4 py-3 text-xs font-extrabold text-white disabled:opacity-40">{busy ? 'ADDING…' : 'REORDER LAST BASKET'}</button></div><div className="rounded-3xl bg-[#eef5e8] p-5"><div className="flex items-center gap-2 text-sm font-extrabold text-[#173d2e]"><TrendingUp size={18}/> Your frequent buys</div><div className="mt-3 space-y-2">{frequent.length ? frequent.map(({product, quantity}) => product && <div key={product.id} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2"><div className="min-w-0"><div className="truncate text-xs font-extrabold">{product.name}</div><div className="text-[10px] text-[#7b887f]">{quantity} bought</div></div><button onClick={() => onAdd(product.id)} className="rounded-xl bg-[#173d2e] p-2 text-white"><ShoppingBag size={14}/></button></div>) : <div className="text-xs text-[#748078]">Complete an order to build your shopping insights.</div>}</div></div></div>}</div></section>;
}
