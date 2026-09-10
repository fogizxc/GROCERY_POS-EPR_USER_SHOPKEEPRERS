import { useEffect, useState } from 'react';
import { Check, ChevronRight, Clock3, Package, RotateCcw, Truck, X } from 'lucide-react';
import { api, type ApiOrder, type OrderStatus } from '../services/api';

const steps: { status: OrderStatus; label: string }[] = [
  { status: 'PLACED', label: 'Order placed' },
  { status: 'ACCEPTED', label: 'Store accepted' },
  { status: 'PICKING', label: 'Picking items' },
  { status: 'PACKING', label: 'Packed' },
  { status: 'READY', label: 'Ready for delivery' },
  { status: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { status: 'DELIVERED', label: 'Delivered' },
];

const rank = (status: OrderStatus) => steps.findIndex(s => s.status === status);

function statusLabel(status: OrderStatus) {
  return status === 'OUT_FOR_DELIVERY' ? 'Out for delivery' : status.replaceAll('_', ' ').toLowerCase().replace(/(^| )\S/g, x => x.toUpperCase());
}

export function CustomerOrders({ flash }: { flash: (message: string) => void }) {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [selected, setSelected] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [unavailable, setUnavailable] = useState<string[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.customerOrders();
      setOrders(data);
      if (selected) setSelected(data.find(o => o.id === selected.id) ?? selected);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Unable to load your orders');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const reorder = async (order: ApiOrder) => {
    setBusy(order.id); setUnavailable([]);
    try {
      const result = await api.reorder(order.id);
      if (result.unavailable.length) {
        setUnavailable(result.unavailable);
        flash(`${result.unavailable.length} item${result.unavailable.length > 1 ? 's are' : ' is'} unavailable`);
      } else flash('Everything from this order is available to reorder');
      if (result.items.length) {
        flash(`${result.items.length} item${result.items.length > 1 ? 's' : ''} ready to add to cart`);
      }
    } catch (e) { flash(e instanceof Error ? e.message : 'Reorder failed'); }
    finally { setBusy(''); }
  };

  if (loading) return <section className="mx-auto max-w-[1500px] px-4 py-10 sm:px-6 lg:px-8"><div className="rounded-3xl bg-white p-8 text-sm font-semibold text-[#718078] shadow-sm">Loading your orders…</div></section>;

  return <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#819087]">Your account</p><h2 className="heading mt-1 text-3xl font-extrabold text-[#173d2e]">My orders</h2><p className="mt-1 text-sm text-[#718078]">Track deliveries, review past purchases and reorder in seconds.</p></div>
      <div className="rounded-full bg-white px-4 py-2 text-xs font-extrabold text-[#52655b] shadow-sm">{orders.length} order{orders.length === 1 ? '' : 's'}</div>
    </div>
    {!orders.length ? <div className="mt-6 rounded-3xl bg-white p-8 text-center shadow-sm"><Package className="mx-auto text-[#6d947d]" size={34}/><h3 className="mt-3 font-extrabold text-[#173d2e]">No orders yet</h3><p className="mt-1 text-sm text-[#7a8881]">Your completed purchases will appear here.</p></div> :
      <div className="mt-6 grid gap-4 lg:grid-cols-2">{orders.map(order => {
        const active = order.status !== 'DELIVERED' && order.status !== 'CANCELLED';
        return <article key={order.id} className="rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-bold text-[#89958e]">{order.id}</div><h3 className="mt-1 font-extrabold text-[#173d2e]">₹{order.total.toFixed(0)} · {order.items.length} item{order.items.length === 1 ? '' : 's'}</h3></div><span className={`rounded-full px-3 py-1 text-[10px] font-extrabold ${order.status === 'CANCELLED' ? 'bg-[#fff0f0] text-[#a34f4f]' : 'bg-[#eaf3eb] text-[#3c7358]'}`}>{statusLabel(order.status)}</span></div>
          <div className="mt-4 rounded-2xl bg-[#f7f8f3] p-4"><div className="flex items-center gap-2 text-xs font-bold text-[#64736b]"><Clock3 size={15}/> {new Date(order.createdAt).toLocaleString()}</div><div className="mt-4 flex items-center gap-1">{steps.slice(0, 7).map((step, index) => <div key={step.status} className={`h-1.5 flex-1 rounded-full ${rank(order.status) >= index && order.status !== 'CANCELLED' ? 'bg-[#4f8a69]' : 'bg-[#dce2dc]'}`} />)}</div><div className="mt-2 flex justify-between text-[9px] font-bold text-[#7c8982]"><span>Placed</span><span>Delivery</span><span>Done</span></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2">{order.items.slice(0, 4).map(item => <div key={`${order.id}-${item.productId}`} className="rounded-xl bg-[#fafbf8] px-3 py-2 text-xs font-semibold text-[#526159]">{item.name} × {item.quantity}</div>)}</div>
          <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => { setSelected(order); setUnavailable([]); }} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-[#173d2e] px-4 py-3 text-xs font-extrabold text-white"><Truck size={15}/> {active ? 'Track order' : 'View order'} <ChevronRight size={14}/></button><button onClick={() => void reorder(order)} disabled={busy === order.id} className="flex items-center justify-center gap-1 rounded-xl border border-[#dce5dd] px-4 py-3 text-xs font-extrabold text-[#315245] disabled:opacity-50"><RotateCcw size={14}/> {busy === order.id ? 'Checking…' : 'Reorder'}</button></div>
        </article>;
      })}</div>}

    {selected && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" onClick={() => setSelected(null)}><div className="mx-auto mt-8 max-w-2xl rounded-[28px] bg-[#f7f7f2] p-5 shadow-2xl sm:p-7" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#819087]">Live order tracking</p><h3 className="heading mt-1 text-2xl font-extrabold text-[#173d2e]">{selected.id}</h3></div><button onClick={() => setSelected(null)} className="rounded-xl bg-white p-2"><X size={18}/></button></div>
      <div className="mt-6 rounded-3xl bg-white p-5">{selected.status === 'CANCELLED' ? <div className="flex items-center gap-3 rounded-2xl bg-[#fff1f1] p-4 text-sm font-bold text-[#a34f4f]"><X size={20}/> This order was cancelled.</div> : <div className="space-y-5">{steps.map((step, index) => { const done = rank(selected.status) >= index; const current = selected.status === step.status; return <div key={step.status} className="flex gap-3"><div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? 'bg-[#173d2e] text-white' : 'bg-[#e8ede8] text-[#8a978f]'}`}>{done ? <Check size={15}/> : <span className="text-xs font-bold">{index + 1}</span>}</div><div><div className={`text-sm font-extrabold ${current ? 'text-[#173d2e]' : 'text-[#526159]'}`}>{step.label}{current && <span className="ml-2 rounded-full bg-[#d7ef8d] px-2 py-1 text-[9px] uppercase text-[#315245]">Current</span>}</div>{current && <p className="mt-1 text-xs text-[#7a8881]">Your order is currently at this stage.</p>}</div></div>; })}</div>}
      </div>
      <div className="mt-4 rounded-3xl bg-[#173d2e] p-5 text-white"><div className="text-xs font-bold uppercase tracking-[.15em] text-white/55">Order summary</div><div className="mt-3 space-y-2 text-sm">{selected.items.map(item => <div key={`${selected.id}-detail-${item.productId}`} className="flex justify-between gap-4"><span>{item.name} × {item.quantity}</span><span>₹{(item.unitPrice * item.quantity).toFixed(0)}</span></div>)}</div><div className="mt-4 flex justify-between border-t border-white/15 pt-3 text-lg font-extrabold"><span>Total</span><span>₹{selected.total.toFixed(0)}</span></div></div>
      {unavailable.length > 0 && <div className="mt-4 rounded-2xl bg-[#fff6df] p-4 text-xs font-semibold text-[#876523]">Unavailable for reorder: {unavailable.join(', ')}</div>}
      <button onClick={() => void reorder(selected)} disabled={busy === selected.id} className="mt-4 w-full rounded-2xl bg-[#d7ef8d] px-4 py-3 text-sm font-extrabold text-[#173d2e] disabled:opacity-50">{busy === selected.id ? 'Checking availability…' : 'Reorder this basket'}</button>
    </div></div>}
  </section>;
}
