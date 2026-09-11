import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Plus, RefreshCw, Store, UserRound, X } from 'lucide-react';
import { api, type ApiShop } from '../services/api';

type Kind = 'shopkeeper' | 'employee';
type Created = { id: string; name: string; role: Kind; username: string; password: string; shopId?: string; shopName?: string };

type Props = { onLogout: () => void };

export function SuperAdminAccounts({ onLogout }: Props) {
  const [kind, setKind] = useState<Kind>('shopkeeper');
  const [showForm, setShowForm] = useState(false);
  const [shops, setShops] = useState<ApiShop[]>([]);
  const [created, setCreated] = useState<Created[]>([]);
  const [result, setResult] = useState<Created | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', shopId: '', shopName: '', shopAddress: '' });

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [shopList, staff] = await Promise.all([api.adminShops(), api.adminStaff()]);
      setShops(shopList);
      setCreated(staff.filter(user => user.role === 'shopkeeper' || user.role === 'employee').map(user => ({ id: user.id, name: user.name, role: user.role, username: user.id, password: '••••••••', shopId: user.shopId, shopName: shopList.find(s => s.id === user.shopId)?.name })));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load partner accounts'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const create = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) { setError('Name, email and phone are required.'); return; }
    if (kind === 'shopkeeper' && !form.shopName.trim() && !form.shopId) { setError('Enter a new shop name or select an existing shop.'); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const token = localStorage.getItem('freshcart_token');
      const response = await fetch('/api/admin/partner-accounts', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ ...form, kind }) });
      const body = await response.json().catch(() => null) as { account?: Created; error?: string } | null;
      if (!response.ok || !body?.account) throw new Error(body?.error || `Request failed (${response.status})`);
      setResult(body.account); setCreated(current => [body.account!, ...current]); setShowForm(false); setForm({ name: '', email: '', phone: '', address: '', shopId: '', shopName: '', shopAddress: '' }); await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to create account'); }
    finally { setBusy(false); }
  };

  const copy = async (label: string, value: string) => { await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(''), 1500); };
  const switchKind = (next: Kind) => { setKind(next); setShowForm(false); setResult(null); setError(''); };
  const visible = created.filter(item => item.role === kind);

  return <div className="min-h-screen bg-[#0b1511] text-[#eef5f0]">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1511]/95 px-5 py-5 backdrop-blur sm:px-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#8fa49a]">FreshCart owner control center</p><h1 className="mt-1 text-2xl font-black">Shops & Employees</h1><p className="mt-1 text-sm text-[#8fa49a]">Create partner accounts with automatically generated uppercase IDs and numeric passwords.</p></div><div className="flex gap-2"><button onClick={onLogout} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold">Sign out</button></div></div></header>
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      {error && <div className="mb-5 rounded-2xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm font-semibold text-red-200">{error}</div>}
      {result && <div className="mb-6 rounded-3xl border border-[#d7ef8d]/30 bg-[#14251d] p-5"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[#d7ef8d]"><CheckCircle2 size={16}/> Account created successfully</div><h2 className="mt-2 text-xl font-black">{result.name}</h2><p className="mt-1 text-xs text-[#8fa49a]">{result.role === 'shopkeeper' ? `Shopkeeper • ${result.shopName || result.shopId}` : 'Employee'}</p></div><button onClick={() => setResult(null)}><X size={18}/></button></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Credential label="LOGIN ID" value={result.username} copied={copied === 'result-id'} onCopy={() => void copy('result-id', result.username)}/><Credential label="PASSWORD" value={result.password} copied={copied === 'result-pass'} onCopy={() => void copy('result-pass', result.password)}/></div><p className="mt-3 text-xs text-[#8fa49a]">Save these credentials now. The password is intentionally shown only in this creation result.</p></div>}

      <div className="grid gap-5 md:grid-cols-2"><button onClick={() => switchKind('shopkeeper')} className={`group rounded-[28px] border p-7 text-left transition ${kind === 'shopkeeper' ? 'border-[#d7ef8d]/50 bg-[#d7ef8d]/10' : 'border-white/10 bg-[#101c17] hover:border-white/20'}`}><div className="flex items-center justify-between"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d7ef8d] text-[#10251b]"><Store size={25}/></div><span className="text-xs font-black uppercase tracking-wider text-[#8fa49a]">{created.filter(x => x.role === 'shopkeeper').length} accounts</span></div><h2 className="mt-5 text-2xl font-black">SHOPKEEPERS</h2><p className="mt-2 text-sm text-[#8fa49a]">Manage shop owners and create a new shopkeeper login.</p></button><button onClick={() => switchKind('employee')} className={`group rounded-[28px] border p-7 text-left transition ${kind === 'employee' ? 'border-[#d7ef8d]/50 bg-[#d7ef8d]/10' : 'border-white/10 bg-[#101c17] hover:border-white/20'}`}><div className="flex items-center justify-between"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#d7ef8d] text-[#10251b]"><UserRound size={25}/></div><span className="text-xs font-black uppercase tracking-wider text-[#8fa49a]">{created.filter(x => x.role === 'employee').length} accounts</span></div><h2 className="mt-5 text-2xl font-black">EMPLOYEES</h2><p className="mt-2 text-sm text-[#8fa49a]">Manage delivery employees and create a new employee login.</p></button></div>

      <section className="mt-6 rounded-3xl border border-white/10 bg-[#101c17] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#8fa49a]">{kind === 'shopkeeper' ? 'Shopkeeper' : 'Employee'} management</p><h2 className="mt-1 text-xl font-black">{visible.length} existing {kind}s</h2></div><div className="flex gap-2"><button onClick={() => void load()} className="rounded-xl bg-white/5 px-3 py-2 text-xs font-bold"><RefreshCw className="mr-1 inline" size={14}/>Refresh</button><button onClick={() => { setShowForm(true); setResult(null); }} className="rounded-xl bg-[#d7ef8d] px-4 py-2 text-xs font-black text-[#10251b]"><Plus className="mr-1 inline" size={15}/>ADD {kind === 'shopkeeper' ? 'SHOPKEEPER' : 'EMPLOYEE'}</button></div></div>
        {showForm && <div className="mt-5 rounded-3xl border border-[#d7ef8d]/20 bg-[#0b1511] p-5"><div className="flex items-center justify-between"><h3 className="font-black">Create new {kind}</h3><button onClick={() => setShowForm(false)}><X size={18}/></button></div><div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="Full name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))}/><Field label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))}/><Field label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))}/><Field label="Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))}/>{kind === 'employee' && <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8fa49a]">Assign shop (optional)</span><select value={form.shopId} onChange={e => setForm(f => ({ ...f, shopId: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#101c17] px-3 py-3 text-sm"><option value="">No shop assigned</option>{shops.filter(s => s.active).map(shop => <option key={shop.id} value={shop.id}>{shop.name} — {shop.id}</option>)}</select></label>}{kind === 'shopkeeper' && <><Field label="New shop name (leave blank to use existing)" value={form.shopName} onChange={v => setForm(f => ({ ...f, shopName: v }))}/><Field label="New shop address" value={form.shopAddress} onChange={v => setForm(f => ({ ...f, shopAddress: v }))}/><label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8fa49a]">Or select existing shop</span><select value={form.shopId} onChange={e => setForm(f => ({ ...f, shopId: e.target.value }))} className="w-full rounded-xl border border-white/10 bg-[#101c17] px-3 py-3 text-sm"><option value="">Create a new shop</option>{shops.filter(s => s.active).map(shop => <option key={shop.id} value={shop.id}>{shop.name} — {shop.id}</option>)}</select></label></>}</div><div className="mt-4 rounded-2xl bg-[#14251d] p-4 text-xs text-[#a9b9b1]"><b className="text-[#d7ef8d]">Automatic credentials:</b> FreshCart will generate a unique uppercase Login ID and a unique numeric password. You do not type either credential.</div><button disabled={busy} onClick={() => void create()} className="mt-4 w-full rounded-xl bg-[#d7ef8d] px-4 py-3 text-sm font-black text-[#10251b] disabled:opacity-50">{busy ? 'CREATING ACCOUNT…' : `CREATE ${kind === 'shopkeeper' ? 'SHOPKEEPER & SHOP' : 'EMPLOYEE'}`}</button></div>}

        {loading ? <div className="p-10 text-center text-[#8fa49a]">Loading accounts…</div> : visible.length === 0 ? <div className="p-10 text-center text-[#8fa49a]">No {kind}s yet. Click the ADD button above to create the first one.</div> : <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map(item => <article key={item.id} className="rounded-2xl border border-white/10 bg-[#0b1511] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-bold uppercase tracking-wider text-[#8fa49a]">{item.role}</div><h3 className="mt-1 font-black">{item.name}</h3><p className="mt-1 text-xs text-[#8fa49a]">{item.shopName || item.shopId || 'No shop assigned'}</p></div><KeyRound size={17} className="text-[#d7ef8d]"/></div><div className="mt-4 rounded-xl bg-[#101c17] p-3"><div className="text-[9px] font-bold uppercase text-[#8fa49a]">LOGIN ID</div><div className="mt-1 break-all font-mono text-sm font-black tracking-wider text-[#d7ef8d]">{item.username}</div><button onClick={() => void copy(`id-${item.id}`, item.username)} className="mt-2 rounded-lg bg-white/5 px-2 py-1 text-[10px] font-bold"><Copy size={11} className="mr-1 inline"/>{copied === `id-${item.id}` ? 'Copied' : 'Copy ID'}</button></div></article>)}</div>}
      </section>
    </main>
  </div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#8fa49a]">{label}</span><input value={value} onChange={e => onChange(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#101c17] px-3 py-3 text-sm outline-none focus:border-[#d7ef8d]/40" /></label>; }
function Credential({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) { return <div className="rounded-2xl border border-white/10 bg-[#0b1511] p-4"><div className="text-[10px] font-bold uppercase tracking-wider text-[#8fa49a]">{label}</div><div className="mt-2 break-all font-mono text-xl font-black tracking-widest text-[#d7ef8d]">{value}</div><button onClick={onCopy} className="mt-2 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold"><Copy size={12} className="mr-1 inline"/>{copied ? 'Copied' : `Copy ${label}`}</button></div>; }
