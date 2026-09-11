import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, Store, UserRound, X } from 'lucide-react';

type Kind = 'shopkeeper' | 'employee';
type Account = { id:string; name:string; email:string; phone:string; username?:string; role:string; shopId?:string; active:boolean };
type Created = { loginId:string; password:string; partner:{id:string;name:string;email:string;phone:string;role:string;shopId?:string;shopName?:string} };

async function adminRequest<T>(path:string, options:RequestInit={}):Promise<T>{
  const token=localStorage.getItem('freshcart_token');
  const headers=new Headers(options.headers); headers.set('Content-Type','application/json'); if(token)headers.set('Authorization',`Bearer ${token}`);
  const response=await fetch(`/api${path}`,{...options,headers});
  if(!response.ok){const body=await response.json().catch(()=>null) as {error?:string}|null;throw new Error(body?.error||`Request failed (${response.status})`);}
  return response.json() as Promise<T>;
}

export function PartnerCredentialManager({embedded=false}:{embedded?:boolean}){
  const [kind,setKind]=useState<Kind>('shopkeeper');
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [open,setOpen]=useState(embedded);
  const [adding,setAdding]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState('');
  const [created,setCreated]=useState<Created|null>(null);
  const [form,setForm]=useState({name:'',email:'',phone:'',address:'',city:'',state:'',postalCode:'',businessName:'',designation:''});

  const load=async()=>{setError('');try{const list=await adminRequest<Account[]>('/admin/staff');setAccounts(list.filter(a=>a.role===kind));}catch(err){setError(err instanceof Error?err.message:'Unable to load accounts');}};
  useEffect(()=>{if(open)void load();},[open,kind]);
  const visibleAccounts=useMemo(()=>accounts.filter(a=>a.active),[accounts]);
  const setField=(key:keyof typeof form,value:string)=>setForm(current=>({...current,[key]:value}));

  const create=async()=>{
    setError('');
    if(!form.name||!form.email||!form.phone||!form.address||!form.city||!form.state||!form.postalCode){setError('Fill every required personal and address field.');return;}
    if(kind==='shopkeeper'&&!form.businessName){setError('Enter the new shop name.');return;}
    setBusy(true);setCreated(null);
    try{
      const result=await adminRequest<Created>('/admin/partners/create',{method:'POST',body:JSON.stringify({...form,kind})});
      setCreated(result);setAdding(false);setForm({name:'',email:'',phone:'',address:'',city:'',state:'',postalCode:'',businessName:'',designation:''});await load();
    }catch(err){setError(err instanceof Error?err.message:'Unable to create account');}
    finally{setBusy(false);}
  };
  const copy=async(label:string,value:string)=>{try{await navigator.clipboard.writeText(value);setCopied(label);window.setTimeout(()=>setCopied(''),1500);}catch{setError('Clipboard access is unavailable.');}};

  const panel=<div className={embedded?'min-h-[calc(100vh-90px)] bg-[#0b1511] p-5 text-[#eef5f0] sm:p-8':'fixed inset-0 z-50 bg-[#173d2e]/45 p-3 backdrop-blur-sm sm:p-6'}>
    <div className={embedded?'mx-auto max-w-7xl':'mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-[#f7f7f2] text-[#173d2e] shadow-2xl'}>
      <div className={embedded?'rounded-3xl border border-white/10 bg-[#101c17] p-5 sm:p-7':'flex items-center justify-between border-b border-black/5 bg-white px-5 py-4 sm:px-7'}>
        <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[#d7ef8d]"><ShieldCheck size={18}/><span className="text-[10px] font-extrabold uppercase tracking-[.18em]">Owner partner control</span></div><h2 className="mt-1 text-2xl font-black">Shops & Employees</h2><p className={embedded?'mt-1 text-xs text-[#8fa49a]':'mt-1 text-xs text-[#74837a]'}>Choose a partner type, review account IDs, or add a new partner with auto-generated credentials.</p></div>{!embedded&&<button onClick={()=>setOpen(false)} className="rounded-full p-2 text-[#64756c] hover:bg-[#edf2ed]"><X size={19}/></button>}</div>
      </div>
      <div className={embedded?'mt-5':'flex-1 overflow-y-auto p-5 sm:p-7'}>
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <section className={embedded?'rounded-3xl border border-white/10 bg-[#101c17] p-5 sm:p-6':'rounded-3xl bg-white p-5 shadow-sm sm:p-6'}>
            <div className="grid gap-3 sm:grid-cols-2">
              <button onClick={()=>setKind('shopkeeper')} className={`rounded-2xl border p-5 text-left transition ${kind==='shopkeeper'?'border-[#d7ef8d]/50 bg-[#d7ef8d]/10':'border-white/10 bg-white/[.03]'}`}><Store size={22}/><div className="mt-3 text-lg font-black">SHOPKEEPERS</div><div className="mt-1 text-xs opacity-70">Manage shop owners and their shops</div></button>
              <button onClick={()=>setKind('employee')} className={`rounded-2xl border p-5 text-left transition ${kind==='employee'?'border-[#d7ef8d]/50 bg-[#d7ef8d]/10':'border-white/10 bg-white/[.03]'}`}><UserRound size={22}/><div className="mt-3 text-lg font-black">EMPLOYEES</div><div className="mt-1 text-xs opacity-70">Manage delivery and store employees</div></button>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-extrabold uppercase tracking-wider opacity-60">{kind} accounts</div><div className="mt-1 text-sm font-bold">{visibleAccounts.length} active accounts</div></div><div className="flex gap-2"><button onClick={()=>void load()} className="rounded-xl bg-white/5 p-3"><RefreshCw size={16}/></button><button onClick={()=>{setAdding(true);setError('');setCreated(null)}} className="inline-flex items-center gap-2 rounded-xl bg-[#d7ef8d] px-4 py-3 text-xs font-black text-[#10251b]"><Plus size={15}/>ADD {kind==='shopkeeper'?'SHOP':'EMPLOYEE'}</button></div></div>
            {visibleAccounts.length===0?<div className="mt-4 rounded-2xl border border-dashed border-white/10 p-8 text-center text-xs opacity-60">No {kind} accounts yet. Use the Add button to create one.</div>:<div className="mt-4 grid gap-3 sm:grid-cols-2">{visibleAccounts.map(account=><div key={account.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-wider opacity-50">{kind}</div><div className="mt-1 font-black">{account.name}</div><div className="mt-1 text-xs opacity-60">{account.email} • {account.phone}</div></div><span className="rounded-full bg-[#d7ef8d] px-2 py-1 text-[9px] font-black text-[#10251b]">ACTIVE</span></div><div className="mt-3 rounded-xl bg-[#0b1511] p-3"><div className="text-[9px] font-bold uppercase tracking-wider opacity-50">LOGIN ID</div><div className="mt-1 flex items-center justify-between gap-2 font-mono text-sm font-black tracking-wider text-[#d7ef8d]"><span>{account.username||'—'}</span>{account.username&&<button onClick={()=>void copy(`id-${account.id}`,account.username!)}><Copy size={14}/></button>}</div></div><div className="mt-2 text-[10px] opacity-50">Password is securely hashed and is shown only when a new account is created.</div></div>)}</div>}
          </section>
          <aside className={embedded?'rounded-3xl border border-white/10 bg-[#101c17] p-5':'rounded-3xl bg-white p-5 shadow-sm'}>
            <div className="flex items-center gap-2"><KeyRound size={18}/><div className="font-black">Credential rules</div></div>
            <div className="mt-4 space-y-3 text-xs leading-5 opacity-70"><p><b className="opacity-100">LOGIN ID:</b> automatically generated in CAPITAL LETTERS and numbers.</p><p><b className="opacity-100">PASSWORD:</b> automatically generated as a strong numeric password.</p><p><b className="opacity-100">SHOPKEEPER:</b> creating one also creates the new shop and links it to the account.</p><p><b className="opacity-100">SECURITY:</b> passwords are hashed in the database. The generated password is displayed after creation so you can save/share it securely.</p></div>
          </aside>
        </div>
      </div>
    </div>

    {adding&&<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[#101c17] p-5 text-[#eef5f0] shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><div className="text-xs font-black uppercase tracking-[.16em] text-[#d7ef8d]">Add {kind==='shopkeeper'?'new shop':'new employee'}</div><h3 className="mt-1 text-2xl font-black">Enter partner details</h3></div><button onClick={()=>setAdding(false)} className="rounded-xl bg-white/5 p-2"><X size={18}/></button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <Field label="Full name *" value={form.name} onChange={v=>setField('name',v)} />
        <Field label="Email *" type="email" value={form.email} onChange={v=>setField('email',v)} />
        <Field label="Phone *" value={form.phone} onChange={v=>setField('phone',v)} />
        {kind==='employee'?<Field label="Designation" value={form.designation} onChange={v=>setField('designation',v)} placeholder="Delivery / Store staff"/>:<Field label="Shop name *" value={form.businessName} onChange={v=>setField('businessName',v)} />}
        <div className="sm:col-span-2"><Field label="Address *" value={form.address} onChange={v=>setField('address',v)} /></div>
        <Field label="City *" value={form.city} onChange={v=>setField('city',v)} />
        <Field label="State *" value={form.state} onChange={v=>setField('state',v)} />
        <Field label="Postal code *" value={form.postalCode} onChange={v=>setField('postalCode',v)} />
      </div>
      {error&&<div className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200">{error}</div>}
      <button disabled={busy} onClick={()=>void create()} className="mt-5 w-full rounded-2xl bg-[#d7ef8d] px-5 py-4 text-sm font-black text-[#10251b] disabled:opacity-50">{busy?'Generating ID, password & account…':`CREATE ${kind==='shopkeeper'?'SHOP + SHOPKEEPER':'EMPLOYEE'}`}</button>
    </div></div>}

    {created&&<div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-3xl border border-[#d7ef8d]/30 bg-[#14251d] p-6 text-[#eef5f0] shadow-2xl"><div className="flex items-center gap-2 text-[#d7ef8d]"><CheckCircle2 size={22}/><span className="font-black">Account created successfully</span></div><h3 className="mt-2 text-2xl font-black">Save these credentials</h3><p className="mt-1 text-xs text-[#8fa49a]">The password is numeric and the login ID uses CAPITAL LETTERS/numbers. The password will not be recoverable from the database later.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><CredentialBox label="LOGIN ID" value={created.loginId} copied={copied==='login'} onCopy={()=>void copy('login',created.loginId)}/><CredentialBox label="PASSWORD" value={created.password} copied={copied==='password'} onCopy={()=>void copy('password',created.password)}/></div><div className="mt-4 rounded-2xl bg-white/5 p-4 text-xs"><div className="font-black">{created.partner.name}</div><div className="mt-1 text-[#8fa49a]">{created.partner.email} • {created.partner.phone}</div>{created.partner.shopName&&<div className="mt-1 text-[#d7ef8d]">Shop: {created.partner.shopName}</div>}</div><button onClick={()=>setCreated(null)} className="mt-5 w-full rounded-xl bg-[#d7ef8d] px-4 py-3 text-sm font-black text-[#10251b]">DONE</button></div></div>}
  </div>;

  if(embedded)return panel;
  return open?panel:<button onClick={()=>setOpen(true)} className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-2xl bg-[#173d2e] px-4 py-3 text-xs font-extrabold text-white shadow-xl hover:bg-[#24523e]"><KeyRound size={16}/>Partner Credentials</button>;
}

function Field({label,value,onChange,type='text',placeholder}:{label:string;value:string;onChange:(value:string)=>void;type?:string;placeholder?:string}){return <label className="block"><span className="mb-1.5 block text-[10px] font-extrabold uppercase tracking-wide text-[#8fa49a]">{label}</span><input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1511] px-3 py-3 text-sm outline-none focus:border-[#d7ef8d]/50"/></label>}
function CredentialBox({label,value,copied,onCopy}:{label:string;value:string;copied:boolean;onCopy:()=>void}){return <div className="rounded-2xl border border-white/10 bg-[#0b1511] p-4"><div className="text-[10px] font-black uppercase tracking-wider text-[#8fa49a]">{label}</div><div className="mt-2 flex items-center justify-between gap-3 font-mono text-lg font-black tracking-wider text-[#d7ef8d]"><span className="break-all">{value}</span><button onClick={onCopy} className="shrink-0 rounded-lg bg-white/5 p-2"><Copy size={15}/></button></div><div className="mt-1 text-[9px] text-[#8fa49a]">{copied?'Copied':'Copy securely'}</div></div>}
