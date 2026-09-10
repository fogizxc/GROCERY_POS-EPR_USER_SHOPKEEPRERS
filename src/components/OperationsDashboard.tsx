import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, AlertTriangle, Boxes, CheckCircle2, Clock3, PackageCheck, RefreshCw, Truck, Users, IndianRupee } from 'lucide-react';
import { api, type ApiAttendance, type ApiNotification, type ApiOrder, type ApiProduct, type ApiUser } from '../services/api';

type Mode = 'shopkeeper' | 'admin';
type Props = { mode: Mode; orders: ApiOrder[]; onRefresh: () => Promise<void>; flash: (message: string) => void };

const stages = ['PLACED', 'ACCEPTED', 'PICKING', 'PACKING', 'READY'] as const;

export function OperationsDashboard({ mode, orders, onRefresh, flash }: Props) {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [staff, setStaff] = useState<ApiUser[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [attendance, setAttendance] = useState<ApiAttendance[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<'orders' | 'inventory' | 'people'>('orders');

  const load = async () => {
    try {
      if (mode === 'admin') {
        const [p, s, a, n] = await Promise.all([api.adminProducts(), api.adminStaff(), api.attendance(), api.notifications()]);
        setProducts(p); setStaff(s); setAttendance(a); setNotifications(n);
      } else {
        const [p, a, n] = await Promise.all([api.products(), api.attendance(), api.notifications()]);
        setProducts(p); setAttendance(a); setNotifications(n);
      }
    } catch (error) { flash(error instanceof Error ? error.message : 'Unable to load operations'); }
  };
  useEffect(() => { void load(); }, [mode]);

  const refresh = async () => { await Promise.all([onRefresh(), load()]); flash('Workspace refreshed'); };
  const activeOrders = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status));
  const deliveredRevenue = orders.filter(o => o.status === 'DELIVERED').reduce((sum, o) => sum + o.total, 0);
  const lowStock = products.filter(p => p.stock <= p.minStock);

  const advance = async (order: ApiOrder) => {
    const next: Record<string, string> = { PLACED: 'ACCEPTED', ACCEPTED: 'PICKING', PICKING: 'PACKING', PACKING: 'READY' };
    const target = next[order.status];
    if (!target) return;
    setBusy(order.id);
    try { await api.updateOrderStatus(order.id, target as ApiOrder['status']); await refresh(); flash(`${order.id} → ${target}`); }
    catch (error) { flash(error instanceof Error ? error.message : 'Order update failed'); }
    finally { setBusy(null); }
  };

  const updateStock = async (product: ApiProduct, delta: number) => {
    setBusy(`stock-${product.id}`);
    try { await api.updateStock(product.id, Math.max(0, product.stock + delta)); await load(); flash(`${product.name} stock updated`); }
    catch (error) { flash(error instanceof Error ? error.message : 'Stock update failed'); }
    finally { setBusy(null); }
  };

  return <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#819087]">{mode === 'admin' ? 'Owner / Admin ERP' : 'Shopkeeper / Employee'}</p><h1 className="heading mt-1 text-3xl font-extrabold text-[#173d2e]">{mode === 'admin' ? 'Network control center' : 'Today’s operations'}</h1><p className="mt-1 text-sm text-[#74837a]">Orders, inventory, staff activity and alerts in one workspace.</p></div>
      <button onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-2xl bg-[#173d2e] px-4 py-3 text-sm font-extrabold text-white"><RefreshCw size={16}/>Refresh</button>
    </div>

    <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi icon={<PackageCheck/>} label="Active orders" value={String(activeOrders.length)} sub="need attention"/>
      <Kpi icon={<IndianRupee/>} label="Delivered sales" value={`₹${deliveredRevenue.toFixed(0)}`} sub="completed orders"/>
      <Kpi icon={<AlertTriangle/>} label="Low stock" value={String(lowStock.length)} sub="at or below minimum"/>
      <Kpi icon={<Users/>} label="Team" value={String(staff.length)} sub={mode === 'admin' ? 'connected staff' : 'assigned staff'}/>
    </section>

    <div className="mt-7 flex gap-2 overflow-x-auto"><Tab active={tab === 'orders'} onClick={() => setTab('orders')}>Orders</Tab><Tab active={tab === 'inventory'} onClick={() => setTab('inventory')}>Inventory</Tab><Tab active={tab === 'people'} onClick={() => setTab('people')}>People & alerts</Tab></div>

    {tab === 'orders' && <section className="mt-4 grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="heading text-xl font-extrabold text-[#173d2e]">Order pipeline</h2><p className="mt-1 text-xs text-[#7d8c83]">Move each order through the operational stages.</p></div><Activity className="text-[#5d836b]" size={20}/></div><div className="mt-4 space-y-3">{activeOrders.map(o => <OrderRow key={o.id} order={o} busy={busy === o.id} onAdvance={() => void advance(o)} mode={mode}/>)}{!activeOrders.length && <Empty text="No active orders right now."/>}</div></div>
      <div className="rounded-3xl bg-[#173d2e] p-5 text-white shadow-sm"><div className="flex items-center gap-2"><Truck size={19}/><h2 className="font-extrabold">Fulfilment pulse</h2></div><div className="mt-5 space-y-4">{stages.map(stage => { const count = orders.filter(o => o.status === stage).length; return <div key={stage}><div className="flex justify-between text-xs"><span className="text-white/65">{stage.replace('_',' ')}</span><b>{count}</b></div><div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-2 rounded-full bg-[#d7ef8d]" style={{ width: `${Math.min(100, count * 18)}%` }}/></div></div> })}</div></div>
    </section>}

    {tab === 'inventory' && <section className="mt-4 rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h2 className="heading text-xl font-extrabold text-[#173d2e]">Inventory control</h2><p className="mt-1 text-xs text-[#7d8c83]">Update quantities directly against the live catalogue.</p></div><Boxes className="text-[#5d836b]"/></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{products.map(p => <div key={p.id} className={`rounded-2xl border p-4 ${p.stock <= p.minStock ? 'border-[#e8c6a5] bg-[#fffaf4]' : 'border-black/5 bg-[#fafbf8]'}`}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-extrabold text-[#203229]">{p.name}</div><div className="mt-1 text-xs text-[#7b8981]">{p.category} • {p.unit}</div></div>{p.stock <= p.minStock && <AlertTriangle size={17} className="text-[#c77b38"/>}</div><div className="mt-4 flex items-center justify-between"><div><span className="text-xl font-extrabold text-[#173d2e]">{p.stock}</span><span className="ml-1 text-xs text-[#89958e]">in stock</span></div><div className="flex gap-1"><button disabled={busy === `stock-${p.id}`} onClick={() => void updateStock(p, -1)} className="h-9 w-9 rounded-xl bg-[#edf2ed] font-bold">−</button><button disabled={busy === `stock-${p.id}`} onClick={() => void updateStock(p, 1)} className="h-9 w-9 rounded-xl bg-[#173d2e] text-white font-bold">+</button></div></div></div>)}{!products.length && <Empty text="No catalogue records returned."/>}</div></section>}

    {tab === 'people' && <section className="mt-4 grid gap-5 lg:grid-cols-2"><Panel title="Notifications"><div className="space-y-3">{notifications.slice(0, 8).map(n => <div key={n.id} className="rounded-2xl bg-[#fafbf8] p-4"><div className="text-sm font-extrabold text-[#203229]">{n.title}</div><div className="mt-1 text-xs leading-5 text-[#718078]">{n.message}</div></div>)}{!notifications.length && <Empty text="No notifications."/>}</div></Panel><Panel title="Attendance"><div className="space-y-3">{attendance.slice(0, 8).map(a => <div key={a.id} className="flex items-center justify-between rounded-2xl bg-[#fafbf8] p-4"><div><div className="text-sm font-extrabold text-[#203229]">{a.date}</div><div className="mt-1 text-xs text-[#718078]">{a.checkIn ? new Date(a.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} → {a.checkOut ? new Date(a.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'open'}</div></div><span className="rounded-full bg-[#edf3ee] px-3 py-1 text-[10px] font-extrabold text-[#47715a]">{a.status}</span></div>)}{!attendance.length && <Empty text="No attendance records."/>}</div></Panel></section>}
  </main>;
}

function OrderRow({ order, busy, onAdvance, mode }: { order: ApiOrder; busy: boolean; onAdvance: () => void; mode: Mode }) { const next: Record<string,string> = { PLACED:'Accept', ACCEPTED:'Start picking', PICKING:'Start packing', PACKING:'Mark ready' }; return <div className="rounded-2xl border border-black/5 bg-[#fafbf8] p-4"><div className="flex flex-wrap items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf1ea] text-[#3c7358]"><PackageCheck size={18}/></div><div className="min-w-[180px] flex-1"><div className="text-sm font-extrabold text-[#203229]">{order.id}</div><div className="mt-1 text-xs text-[#7d8b83]">{order.items.reduce((s, i) => s + i.quantity, 0)} items • ₹{order.total} • {order.paymentMethod}</div></div><span className="rounded-full bg-[#edf3ee] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#47715a]">{order.status.replaceAll('_',' ')}</span>{mode === 'shopkeeper' && next[order.status] && <button disabled={busy} onClick={onAdvance} className="rounded-xl bg-[#173d2e] px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">{busy ? 'Updating…' : next[order.status]}</button>}</div><div className="mt-3 flex gap-1">{stages.map(stage => <div key={stage} className={`h-1.5 flex-1 rounded-full ${stages.indexOf(stage) <= stages.indexOf(order.status as typeof stages[number]) ? 'bg-[#5d836b]' : 'bg-[#e6ebe6]'}`}/>)}</div></div> }
function Kpi({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) { return <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf1ea] text-[#3c7358]">{icon}</div><div className="mt-4 text-xs font-bold text-[#7d8c83]">{label}</div><div className="mt-1 text-2xl font-extrabold text-[#173d2e]">{value}</div><div className="mt-1 text-xs text-[#8a968f]">{sub}</div></div> }
function Tab({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) { return <button onClick={onClick} className={`rounded-xl px-4 py-2 text-xs font-extrabold ${active ? 'bg-[#173d2e] text-white' : 'bg-white text-[#617169]'}`}>{children}</button> }
function Panel({ title, children }: { title: string; children: ReactNode }) { return <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6"><h2 className="heading text-xl font-extrabold text-[#173d2e]">{title}</h2><div className="mt-4">{children}</div></div> }
function Empty({ text }: { text: string }) { return <div className="py-10 text-center text-sm text-[#7d8c83]"><CheckCircle2 className="mx-auto mb-2 text-[#7ca486]" size={22}/>{text}</div> }
