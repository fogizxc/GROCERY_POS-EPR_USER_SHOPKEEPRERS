import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, MapPin, PackageCheck, RefreshCw, Truck } from 'lucide-react';
import { api, type ApiDeliveryQueueItem, type ApiUser, type DeliveryStatus } from '../services/api';

type Props = { admin?: boolean; flash: (message: string) => void };
const steps: DeliveryStatus[] = ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const next: Partial<Record<DeliveryStatus, DeliveryStatus>> = { ASSIGNED: 'PICKED_UP', PICKED_UP: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' };

export function DeliveryDashboard({ admin = false, flash }: Props) {
  const [orders, setOrders] = useState<ApiDeliveryQueueItem[]>([]);
  const [employees, setEmployees] = useState<ApiUser[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const queue = await api.deliveryQueue();
      setOrders(queue);
      if (admin) setEmployees(await api.deliveryEmployees());
    } catch (error) { flash(error instanceof Error ? error.message : 'Unable to load delivery workspace'); }
  };
  useEffect(() => { void load(); }, [admin]);

  const assign = async (orderId: string) => {
    const employeeId = selectedEmployee[orderId];
    if (!employeeId) return flash('Choose a delivery employee first');
    setBusy(orderId);
    try { await api.assignDelivery(orderId, employeeId); await load(); flash('Delivery assigned'); }
    catch (error) { flash(error instanceof Error ? error.message : 'Assignment failed'); }
    finally { setBusy(null); }
  };

  const advance = async (order: ApiDeliveryQueueItem) => {
    const currentStatus = order.deliveryStatus ?? (order.status === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'ASSIGNED');
    const target = next[currentStatus];
    if (!target) return;
    setBusy(order.id);
    try { await api.deliveryStatus(order.id, target); await load(); flash(`${order.id} → ${target.replaceAll('_', ' ')}`); }
    catch (error) { flash(error instanceof Error ? error.message : 'Delivery update failed'); }
    finally { setBusy(null); }
  };

  return <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.18em] text-[#819087]">{admin ? 'Admin / Dispatch' : 'Employee / Delivery'}</p><h1 className="heading mt-1 text-3xl font-extrabold text-[#173d2e]">Delivery control</h1><p className="mt-1 text-sm text-[#74837a]">Assignments, pickups and live delivery progress.</p></div><button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-2xl bg-[#173d2e] px-4 py-3 text-sm font-extrabold text-white"><RefreshCw size={16}/>Refresh</button></div>
    <section className="mt-7 grid gap-4 sm:grid-cols-3"><Kpi icon={<Truck/>} label="Queue" value={String(orders.length)} sub="delivery orders"/><Kpi icon={<PackageCheck/>} label="In transit" value={String(orders.filter(o => (o.deliveryStatus ?? (o.status === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'ASSIGNED')) === 'OUT_FOR_DELIVERY').length)} sub="out for delivery"/><Kpi icon={<CheckCircle2/>} label="Assigned" value={String(orders.filter(o => (o.deliveryStatus ?? 'ASSIGNED') === 'ASSIGNED').length)} sub="awaiting pickup"/></section>
    <section className="mt-7 rounded-3xl bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center gap-2"><MapPin className="text-[#5d836b]" size={20}/><h2 className="heading text-xl font-extrabold text-[#173d2e]">Delivery queue</h2></div><div className="mt-4 space-y-3">{orders.map(order => { const currentStatus = order.deliveryStatus ?? (order.status === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'ASSIGNED'); const current = steps.indexOf(currentStatus); const target = next[currentStatus]; return <div key={order.id} className="rounded-2xl border border-black/5 bg-[#fafbf8] p-4"><div className="flex flex-wrap items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf1ea] text-[#3c7358]"><PackageCheck size={18}/></div><div className="min-w-[190px] flex-1"><div className="text-sm font-extrabold text-[#203229]">{order.id}</div><div className="mt-1 text-xs text-[#7d8b83]">{order.items.reduce((s, i) => s + i.quantity, 0)} items • ₹{order.total}</div></div><span className="rounded-full bg-[#edf3ee] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[#47715a]">{currentStatus.replaceAll('_', ' ')}</span>{target && <button disabled={busy === order.id} onClick={() => void advance(order)} className="rounded-xl bg-[#173d2e] px-3 py-2 text-xs font-extrabold text-white disabled:opacity-50">{busy === order.id ? 'Updating…' : target === 'DELIVERED' ? 'Mark delivered' : target.replaceAll('_', ' ')}</button>}</div><div className="mt-4 flex gap-1">{steps.map((step, index) => <div key={step} className={`h-1.5 flex-1 rounded-full ${index <= current ? 'bg-[#5d836b]' : 'bg-[#e6ebe6]'}`}/>)}</div>{admin && !order.deliveryEmployeeId && order.status === 'READY' && <div className="mt-4 flex flex-wrap gap-2"><select value={selectedEmployee[order.id] ?? ''} onChange={e => setSelectedEmployee(v => ({ ...v, [order.id]: e.target.value }))} className="min-w-[220px] rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold"><option value="">Assign employee…</option>{employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} • {employee.phone}</option>)}</select><button disabled={busy === order.id} onClick={() => void assign(order.id)} className="rounded-xl bg-[#eaf1ea] px-4 py-2 text-xs font-extrabold text-[#315245]">Assign delivery</button></div>}</div>; })}{!orders.length && <div className="py-12 text-center text-sm text-[#7d8c83]">No delivery orders in the queue.</div>}</div></section>
  </main>;
}
function Kpi({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) { return <div className="rounded-3xl bg-white p-5 shadow-sm"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eaf1ea] text-[#3c7358]">{icon}</div><div className="mt-4 text-xs font-bold text-[#7d8c83]">{label}</div><div className="mt-1 text-2xl font-extrabold text-[#173d2e]">{value}</div><div className="mt-1 text-xs text-[#8a968f]">{sub}</div></div>; }
