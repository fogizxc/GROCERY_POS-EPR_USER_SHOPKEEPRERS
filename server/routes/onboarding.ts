import { Router } from 'express';
import { mongoDb } from '../db/mongodb.ts';

export type PartnerApplicationType = 'shopkeeper' | 'employee';

interface PartnerApplication {
  referenceId: string;
  type: PartnerApplicationType;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  idProofType: string;
  idProofNumber: string;
  preferredCallAt: string;
  status: 'PENDING_REVIEW';
  callStatus: 'SCHEDULED';
  submittedAt: string;
  consentedAt: string;
  businessName?: string;
  businessType?: string;
  gstin?: string;
  pan?: string;
  tradeLicense?: string;
  fssaiLicense?: string;
  establishmentYear?: string;
  branches?: number;
  qualification?: string;
  experience?: number;
  preferredRole?: string;
  availability?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export const onboarding = Router();

const clean = (value: unknown, max = 160) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const phonePattern = /^\+?[0-9]{10,15}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const gstinPattern = /^[0-9A-Z]{15}$/;
const panPattern = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

async function syncToGoogleSheet(application: PartnerApplication) {
  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(application),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Google Sheet webhook returned ${response.status}${text ? `: ${text.slice(0, 180)}` : ''}`);
    }
  } catch (error) {
    console.error('FreshCart Google Sheet sync failed:', error);
  }
}

onboarding.post('/applications', async (req, res) => {
  const body = req.body ?? {};
  const type = body.type as PartnerApplicationType;
  const fullName = clean(body.fullName, 80);
  const email = clean(body.email, 120).toLowerCase();
  const phone = clean(body.phone, 20);
  const address = clean(body.address, 240);
  const city = clean(body.city, 80);
  const state = clean(body.state, 80);
  const postalCode = clean(body.postalCode, 6);
  const idProofType = clean(body.idProofType, 60);
  const idProofNumber = clean(body.idProofNumber, 80).toUpperCase();
  const preferredCallAt = typeof body.preferredCallAt === 'string' ? new Date(body.preferredCallAt) : new Date('invalid');
  const consent = body.consent === true;

  if (!['shopkeeper', 'employee'].includes(type)) return res.status(400).json({ error: 'Choose a valid onboarding type' });
  if (fullName.length < 2 || email.length < 5 || !emailPattern.test(email) || !phonePattern.test(phone)) return res.status(400).json({ error: 'Valid name, email and phone are required' });
  if (!address || !city || !state || !/^\d{6}$/.test(postalCode)) return res.status(400).json({ error: 'Complete address and a valid 6-digit PIN code are required' });
  if (!idProofType || idProofNumber.length < 4) return res.status(400).json({ error: 'One government ID proof and its number are required' });
  if (Number.isNaN(preferredCallAt.getTime()) || preferredCallAt.getTime() <= Date.now()) return res.status(400).json({ error: 'Please choose a future callback date and time' });
  if (!consent) return res.status(400).json({ error: 'Consent is required before submitting an application' });

  const application: PartnerApplication = {
    referenceId: `FC-${type === 'shopkeeper' ? 'ST' : 'EMP'}-${Date.now().toString(36).toUpperCase()}`,
    type,
    fullName,
    email,
    phone,
    address,
    city,
    state,
    postalCode,
    idProofType,
    idProofNumber,
    preferredCallAt: preferredCallAt.toISOString(),
    status: 'PENDING_REVIEW',
    callStatus: 'SCHEDULED',
    submittedAt: new Date().toISOString(),
    consentedAt: new Date().toISOString(),
  };

  if (type === 'shopkeeper') {
    application.businessName = clean(body.businessName, 120);
    application.businessType = clean(body.businessType, 80);
    application.gstin = clean(body.gstin, 15).toUpperCase();
    application.pan = clean(body.pan, 10).toUpperCase();
    application.tradeLicense = clean(body.tradeLicense, 80);
    application.fssaiLicense = clean(body.fssaiLicense, 80);
    application.establishmentYear = clean(body.establishmentYear, 4);
    application.branches = Math.max(1, Math.min(999, Number.parseInt(String(body.branches || '1'), 10) || 1));
    if (application.businessName.length < 2 || !gstinPattern.test(application.gstin ?? '') || !panPattern.test(application.pan ?? '')) return res.status(400).json({ error: 'Business name, valid GSTIN and valid PAN are required' });
  } else {
    application.qualification = clean(body.qualification, 120);
    application.experience = Math.max(0, Math.min(60, Number.parseFloat(String(body.experience || '0')) || 0));
    application.preferredRole = clean(body.preferredRole, 100);
    application.availability = clean(body.availability, 40);
    application.emergencyContactName = clean(body.emergencyContactName, 80);
    application.emergencyContactPhone = clean(body.emergencyContactPhone, 20);
    if (application.qualification.length < 2 || application.preferredRole.length < 2) return res.status(400).json({ error: 'Qualification and preferred role are required' });
    if (application.emergencyContactPhone && !phonePattern.test(application.emergencyContactPhone)) return res.status(400).json({ error: 'Emergency contact phone is invalid' });
  }

  try {
    const db = mongoDb();
    if (db) {
      await db.collection<PartnerApplication>('onboardingApplications').insertOne(application);
    } else {
      console.log('FreshCart onboarding application received:', application.referenceId);
    }
    void syncToGoogleSheet(application);
    return res.status(201).json({ referenceId: application.referenceId, scheduledCallAt: application.preferredCallAt, status: application.status });
  } catch (error) {
    console.error('FreshCart onboarding application failed:', error);
    return res.status(503).json({ error: 'Unable to save your application right now. Please try again.' });
  }
});
