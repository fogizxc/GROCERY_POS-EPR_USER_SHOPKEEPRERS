import { FormEvent, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, CalendarClock, CheckCircle2, FileText, IdCard, Mail, MapPin, Phone, Store, UserRound, X } from 'lucide-react';
import { api, PartnerApplicationInput } from '../services/api';

interface PartnerApplicationModalProps {
  type: 'shopkeeper' | 'employee';
  onClose: () => void;
}

const inputClass = 'w-full rounded-xl border border-black/10 bg-[#fafbf8] px-3.5 py-3 text-sm outline-none transition focus:border-[#6f9f83] focus:ring-2 focus:ring-[#6f9f83]/10';
const labelClass = 'mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-[#68776f]';

function minDateTimeLocal() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function PartnerApplicationModal({ type, onClose }: PartnerApplicationModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<{ referenceId: string; scheduledCallAt: string } | null>(null);
  const [error, setError] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({
    fullName: '', email: '', phone: '', address: '', city: '', state: '', postalCode: '',
    idProofType: 'PAN Card', idProofNumber: '',
    businessName: '', businessType: 'Grocery / Retail Store', gstin: '', pan: '',
    tradeLicense: '', fssaiLicense: '', establishmentYear: '', branches: '1',
    qualification: '', experience: '', preferredRole: 'Store / Operations', availability: 'Full-time',
    emergencyContactName: '', emergencyContactPhone: '',
  });

  useEffect(() => { setCallbackAt(minDateTimeLocal()); }, []);

  const title = type === 'shopkeeper' ? 'Become a FreshCart Partner Store' : 'Join FreshCart as an Employee';
  const description = type === 'shopkeeper'
    ? 'Register your grocery business. Our onboarding team will review the business details and call you for verification.'
    : 'Tell us about your background and identity details. Our recruitment team will review your application and call you for the next step.';

  const update = (key: string, value: string) => setForm(previous => ({ ...previous, [key]: value }));
  const invalidCallback = useMemo(() => !callbackAt || Number.isNaN(new Date(callbackAt).getTime()) || new Date(callbackAt).getTime() <= Date.now(), [callbackAt]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const application: PartnerApplicationInput = type === 'shopkeeper'
        ? {
            type,
            fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim(),
            address: form.address.trim(), city: form.city.trim(), state: form.state.trim(), postalCode: form.postalCode.trim(),
            idProofType: form.idProofType, idProofNumber: form.idProofNumber.trim(),
            businessName: form.businessName.trim(), businessType: form.businessType.trim(), gstin: form.gstin.trim().toUpperCase(),
            pan: form.pan.trim().toUpperCase(), tradeLicense: form.tradeLicense.trim(), fssaiLicense: form.fssaiLicense.trim(),
            establishmentYear: form.establishmentYear, branches: form.branches,
            preferredCallAt: new Date(callbackAt).toISOString(), consent,
          }
        : {
            type,
            fullName: form.fullName.trim(), email: form.email.trim(), phone: form.phone.trim(),
            address: form.address.trim(), city: form.city.trim(), state: form.state.trim(), postalCode: form.postalCode.trim(),
            idProofType: form.idProofType, idProofNumber: form.idProofNumber.trim(),
            qualification: form.qualification.trim(), experience: form.experience, preferredRole: form.preferredRole.trim(),
            availability: form.availability, emergencyContactName: form.emergencyContactName.trim(), emergencyContactPhone: form.emergencyContactPhone.trim(),
            preferredCallAt: new Date(callbackAt).toISOString(), consent,
          };
      const result = await api.submitPartnerApplication(application);
      setSuccess({ referenceId: result.referenceId, scheduledCallAt: result.scheduledCallAt });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit application');
    } finally { setSaving(false); }
  };

  const stepOneValid = form.fullName.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && /^\+?[0-9]{10,15}$/.test(form.phone.trim()) && form.address.trim() && form.city.trim() && form.state.trim() && /^[0-9]{6}$/.test(form.postalCode.trim());
  const stepTwoValid = form.idProofNumber.trim().length >= 4 && !invalidCallback && consent && (type === 'shopkeeper' ? form.businessName.trim().length >= 2 && form.gstin.trim().length >= 5 && form.pan.trim().length >= 5 : form.qualification.trim().length >= 2 && form.preferredRole.trim().length >= 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#173d2e]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="partner-application-title">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 sm:px-7">
          <div><div className="flex items-center gap-2 text-[#356c51]"><BriefcaseBusiness size={17}/><span className="text-[10px] font-extrabold uppercase tracking-[.18em]">FreshCart onboarding</span></div><h3 id="partner-application-title" className="mt-1 text-xl font-extrabold text-[#173d2e]">{title}</h3></div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-[#77867e] transition hover:bg-[#f3f6f0]" aria-label="Close"><X size={18}/></button>
        </div>

        {success ? (
          <div className="px-6 py-10 text-center sm:px-12 sm:py-14">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#edf7ef] text-[#2d8054]"><CheckCircle2 size={32}/></div>
            <h4 className="mt-5 text-2xl font-extrabold text-[#173d2e]">Application submitted</h4>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#67776f]">Your onboarding request is in review. A FreshCart team member will call you at the selected time for verification and the next step.</p>
            <div className="mx-auto mt-6 max-w-md rounded-2xl bg-[#f5f8f2] p-4 text-left text-sm text-[#4e6258]"><div className="flex justify-between gap-4"><span>Reference ID</span><strong className="text-[#173d2e]">{success.referenceId}</strong></div><div className="mt-2 flex justify-between gap-4"><span>Scheduled callback</span><strong className="text-right text-[#173d2e]">{new Date(success.scheduledCallAt).toLocaleString('en-IN')}</strong></div></div>
            <button onClick={onClose} className="mt-7 rounded-xl bg-[#173d2e] px-6 py-3 text-sm font-extrabold text-white hover:bg-[#24523e]">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="max-h-[calc(92vh-82px)] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <p className="max-w-2xl text-sm leading-6 text-[#6c7a73]">{description}</p>
            <div className="mt-5 flex gap-2">{[1, 2].map(number => <div key={number} className={`h-1.5 flex-1 rounded-full ${step >= number ? 'bg-[#4c8b67]' : 'bg-[#e9eee8]'}`} />)}</div>

            {step === 1 ? <div className="mt-6 space-y-5">
              <section><h4 className="flex items-center gap-2 text-sm font-extrabold text-[#173d2e]"><UserRound size={16}/> Basic details</h4><div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label><span className={labelClass}>Full name</span><input required className={inputClass} value={form.fullName} onChange={e=>update('fullName',e.target.value)} placeholder="Your full name" /></label>
                <label><span className={labelClass}>Email</span><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={16}/><input required type="email" className={`${inputClass} pl-10`} value={form.email} onChange={e=>update('email',e.target.value)} placeholder="you@example.com" /></div></label>
                <label><span className={labelClass}>Phone</span><div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={16}/><input required className={`${inputClass} pl-10`} value={form.phone} onChange={e=>update('phone',e.target.value)} placeholder="10-digit mobile number" /></div></label>
                <label className="sm:col-span-2"><span className={labelClass}>Full address</span><div className="relative"><MapPin className="absolute left-3 top-3 text-[#9aa69f]" size={16}/><input required className={`${inputClass} pl-10`} value={form.address} onChange={e=>update('address',e.target.value)} placeholder="Street, locality, building / house number" /></div></label>
                <label><span className={labelClass}>City</span><input required className={inputClass} value={form.city} onChange={e=>update('city',e.target.value)} /></label>
                <label><span className={labelClass}>State</span><input required className={inputClass} value={form.state} onChange={e=>update('state',e.target.value)} /></label>
                <label><span className={labelClass}>PIN code</span><input required inputMode="numeric" maxLength={6} className={inputClass} value={form.postalCode} onChange={e=>update('postalCode',e.target.value.replace(/\D/g,''))} placeholder="6-digit PIN" /></label>
              </div></section>
              {type === 'shopkeeper' && <section className="rounded-2xl bg-[#f6f8f3] p-4"><h4 className="flex items-center gap-2 text-sm font-extrabold text-[#173d2e]"><Store size={16}/> What you are joining as</h4><p className="mt-1 text-xs leading-5 text-[#718078]">Your business details are collected so the FreshCart team can verify the store before activation.</p></section>}
              {type === 'employee' && <section className="rounded-2xl bg-[#f6f8f3] p-4"><h4 className="flex items-center gap-2 text-sm font-extrabold text-[#173d2e]"><IdCard size={16}/> Identity & employment</h4><p className="mt-1 text-xs leading-5 text-[#718078]">Have one accepted government ID ready for the verification call.</p></section>}
              <div className="flex justify-end"><button type="button" disabled={!stepOneValid} onClick={()=>setStep(2)} className="rounded-xl bg-[#173d2e] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-40">Continue</button></div>
            </div> : <div className="mt-6 space-y-5">
              {type === 'shopkeeper' ? <section><h4 className="flex items-center gap-2 text-sm font-extrabold text-[#173d2e]"><Store size={16}/> Business & compliance</h4><div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className={labelClass}>Business / store name</span><input required className={inputClass} value={form.businessName} onChange={e=>update('businessName',e.target.value)} placeholder="Store or company name" /></label>
                <label><span className={labelClass}>Business type</span><select className={inputClass} value={form.businessType} onChange={e=>update('businessType',e.target.value)}><option>Grocery / Retail Store</option><option>Supermarket</option><option>Wholesale / Distributor</option><option>Mini Mart</option><option>Other</option></select></label>
                <label><span className={labelClass}>Number of branches</span><input inputMode="numeric" className={inputClass} value={form.branches} onChange={e=>update('branches',e.target.value.replace(/\D/g,''))} /></label>
                <label><span className={labelClass}>GSTIN</span><input required className={inputClass} value={form.gstin} onChange={e=>update('gstin',e.target.value.toUpperCase())} placeholder="15-character GSTIN" /></label>
                <label><span className={labelClass}>Business PAN</span><input required className={inputClass} value={form.pan} onChange={e=>update('pan',e.target.value.toUpperCase())} placeholder="PAN" /></label>
                <label><span className={labelClass}>Trade / Shop licence</span><input className={inputClass} value={form.tradeLicense} onChange={e=>update('tradeLicense',e.target.value)} placeholder="Licence number" /></label>
                <label><span className={labelClass}>FSSAI licence (if applicable)</span><input className={inputClass} value={form.fssaiLicense} onChange={e=>update('fssaiLicense',e.target.value)} placeholder="FSSAI number" /></label>
                <label><span className={labelClass}>Established year</span><input inputMode="numeric" maxLength={4} className={inputClass} value={form.establishmentYear} onChange={e=>update('establishmentYear',e.target.value.replace(/\D/g,''))} placeholder="2024" /></label>
                <label><span className={labelClass}>Owner ID proof</span><select className={inputClass} value={form.idProofType} onChange={e=>update('idProofType',e.target.value)}><option>PAN Card</option><option>Driving Licence</option><option>Passport</option><option>Voter ID</option><option>Other Government ID</option></select></label>
                <label className="sm:col-span-2"><span className={labelClass}>ID proof number</span><div className="relative"><FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={16}/><input required className={`${inputClass} pl-10`} value={form.idProofNumber} onChange={e=>update('idProofNumber',e.target.value)} placeholder="Use the ID you can verify on the call" /></div></label>
              </div></section> : <section><h4 className="flex items-center gap-2 text-sm font-extrabold text-[#173d2e]"><BriefcaseBusiness size={16}/> Employee profile</h4><div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label><span className={labelClass}>Highest qualification</span><input required className={inputClass} value={form.qualification} onChange={e=>update('qualification',e.target.value)} placeholder="12th / Graduate / MBA etc." /></label>
                <label><span className={labelClass}>Experience (years)</span><input inputMode="decimal" className={inputClass} value={form.experience} onChange={e=>update('experience',e.target.value)} placeholder="0, 1, 2..." /></label>
                <label><span className={labelClass}>Preferred role</span><input required className={inputClass} value={form.preferredRole} onChange={e=>update('preferredRole',e.target.value)} placeholder="Delivery, store, operations..." /></label>
                <label><span className={labelClass}>Availability</span><select className={inputClass} value={form.availability} onChange={e=>update('availability',e.target.value)}><option>Full-time</option><option>Part-time</option><option>Weekend</option><option>Flexible</option></select></label>
                <label><span className={labelClass}>ID proof type</span><select className={inputClass} value={form.idProofType} onChange={e=>update('idProofType',e.target.value)}><option>PAN Card</option><option>Driving Licence</option><option>Passport</option><option>Voter ID</option><option>Other Government ID</option></select></label>
                <label><span className={labelClass}>ID proof number</span><div className="relative"><IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa69f]" size={16}/><input required className={`${inputClass} pl-10`} value={form.idProofNumber} onChange={e=>update('idProofNumber',e.target.value)} placeholder="ID number" /></div></label>
                <label><span className={labelClass}>Emergency contact name</span><input className={inputClass} value={form.emergencyContactName} onChange={e=>update('emergencyContactName',e.target.value)} /></label>
                <label><span className={labelClass}>Emergency contact phone</span><input className={inputClass} value={form.emergencyContactPhone} onChange={e=>update('emergencyContactPhone',e.target.value)} /></label>
              </div></section>}

              <section className="rounded-2xl border border-[#e5eae3] bg-[#fbfcfa] p-4"><h4 className="flex items-center gap-2 text-sm font-extrabold text-[#173d2e]"><CalendarClock size={16}/> Schedule your verification call</h4><p className="mt-1 text-xs leading-5 text-[#718078]">Pick a convenient time. We will save this as the requested onboarding callback slot.</p><div className="mt-3"><label><span className={labelClass}>Preferred date & time</span><input required type="datetime-local" min={minDateTimeLocal()} className={inputClass} value={callbackAt} onChange={e=>setCallbackAt(e.target.value)} /></label></div></section>
              <label className="flex items-start gap-3 rounded-2xl bg-[#f4f7f1] p-4 text-xs leading-5 text-[#5f7067]"><input type="checkbox" className="mt-1" checked={consent} onChange={e=>setConsent(e.target.checked)} /><span>I confirm that the information provided is accurate and I consent to FreshCart using these details for partner/employee onboarding and verification.</span></label>
              {error && <div role="alert" className="rounded-xl bg-[#fff0ed] px-4 py-3 text-xs font-semibold text-[#a14335]">{error}</div>}
              <div className="flex items-center justify-between gap-3"><button type="button" onClick={()=>setStep(1)} className="rounded-xl border border-black/10 px-4 py-3 text-sm font-extrabold text-[#5f6d65]">Back</button><button type="submit" disabled={saving || !stepTwoValid} className="rounded-xl bg-[#173d2e] px-5 py-3 text-sm font-extrabold text-white disabled:opacity-40">{saving ? 'Submitting…' : 'Submit & schedule call'}</button></div>
            </div>}
          </form>
        )}
      </div>
    </div>
  );
}
