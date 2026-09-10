import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { api } from '../services/api';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'login') {
        await api.login(identifier.trim(), 'customer', password);
      } else {
        await api.register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
      }
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to authenticate');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f2] px-4 py-8 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-xl lg:grid-cols-2">
        <section className="hidden bg-[#173d2e] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10"><Leaf size={22}/></div><span className="text-xl font-extrabold">FreshCart</span></div>
            <div className="mt-20 max-w-md"><p className="text-xs font-extrabold uppercase tracking-[.2em] text-[#b9d9bf]">Fresh • local • fast</p><h1 className="heading mt-4 text-5xl font-extrabold leading-tight">Your everyday grocery run, made effortless.</h1><p className="mt-5 text-sm leading-6 text-[#d6e5da]">Shop fresh produce and daily essentials from trusted local stores and get them delivered to your door.</p></div>
          </div>
          <p className="text-xs text-[#b9d9bf]">Secure customer accounts • Your data stays tied to your FreshCart account</p>
        </section>

        <section className="p-6 sm:p-10 lg:p-12">
          <div className="mx-auto max-w-md">
            <div className="lg:hidden flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#173d2e] text-lg">🌿</div><span className="text-lg font-extrabold text-[#173d2e]">FreshCart</span></div>
            <div className="mt-10 lg:mt-4"><p className="text-xs font-extrabold uppercase tracking-[.16em] text-[#819087]">Customer account</p><h2 className="heading mt-2 text-3xl font-extrabold text-[#173d2e]">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p className="mt-2 text-sm text-[#74837b]">{mode === 'login' ? 'Sign in to continue shopping.' : 'Join FreshCart and start your first grocery order.'}</p></div>

            <form onSubmit={submit} className="mt-8 space-y-4">
              {mode === 'register' && <>
                <label className="block"><span className="mb-2 block text-xs font-bold text-[#52655b]">Full name</span><div className="relative"><UserRound className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={17}/><input required value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#fafbf8] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#6f9f83]" placeholder="Your name" /></div></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-[#52655b]">Email</span><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={17}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#fafbf8] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#6f9f83]" placeholder="you@example.com" /></div></label>
                <label className="block"><span className="mb-2 block text-xs font-bold text-[#52655b]">Phone</span><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={17}/><input required value={phone} onChange={e=>setPhone(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#fafbf8] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#6f9f83]" placeholder="10-digit mobile number" /></div></label>
              </>}
              {mode === 'login' && <label className="block"><span className="mb-2 block text-xs font-bold text-[#52655b]">Email or phone</span><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={17}/><input required value={identifier} onChange={e=>setIdentifier(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#fafbf8] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#6f9f83]" placeholder="you@example.com or 10-digit phone" /></div></label>}
              <label className="block"><span className="mb-2 block text-xs font-bold text-[#52655b]">Password</span><div className="relative"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={17}/><input required minLength={8} type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-[#fafbf8] py-3 pl-10 pr-11 text-sm outline-none focus:border-[#6f9f83]" placeholder="At least 8 characters" /><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#77867e]">{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
              {error && <div role="alert" className="rounded-2xl bg-[#fff0ed] px-4 py-3 text-xs font-semibold text-[#a14335]">{error}</div>}
              <button disabled={saving} className="flex w-full items-center justify-center rounded-2xl bg-[#173d2e] px-5 py-3.5 text-sm font-extrabold text-white transition hover:bg-[#24523e] disabled:opacity-50">{saving?'Please wait…':mode==='login'?'Sign in':'Create account'}{!saving&&<ArrowRight size={16} className="ml-2"/>}</button>
            </form>

            <div className="mt-6 text-center text-xs text-[#7a8981]">{mode==='login'?"Don't have an account?":"Already have an account?"} <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}} className="font-extrabold text-[#356c51]">{mode==='login'?'Create one':'Sign in'}</button></div>
          </div>
        </section>
      </div>
    </main>
  );
}
