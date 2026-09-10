import { Router } from 'express';
import { products, orders, shops, users } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { createUser, findOrders, listShops, listStaff } from '../db/repositories';
import { hashPassword } from '../auth/password';
import { adminCatalog } from './adminCatalog';
import { approveSalesImport, rejectSalesImport } from './onboarding';
import type { PartnerApplicationType } from './onboarding';
import type { SalesImport, User } from '../models/domain';
import { ensurePartnerCredentialPools, listPartnerCredentialPool, claimPartnerCredential } from '../auth/shopCredentials';

export const admin = Router();
admin.use(requireAuth, requireRole('admin', 'super_admin'));
admin.use('/catalog', adminCatalog);

admin.get('/dashboard', async (_req, res) => {
  if (mongoDb()) {
    const db = mongoDb()!;
    const [allOrders, allProducts, allShops, staff] = await Promise.all([findOrders(), db.collection<import('../models/domain').Product>('products').find({}).toArray(), listShops(), listStaff()]);
    const delivered = allOrders.filter(o => o.status === 'DELIVERED');
    return res.json({ revenue: delivered.reduce((sum, order) => sum + order.total, 0), activeOrders: allOrders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)).length, products: allProducts.length, lowStock: allProducts.filter(p => p.stock <= p.minStock).length, shops: allShops.length, staff: staff.length });
  }
  const activeOrders = orders.filter(o => !['DELIVERED', 'CANCELLED'].includes(o.status)); const revenue = orders.filter(o => o.status === 'DELIVERED').reduce((s, o) => s + o.total, 0); return res.json({ revenue, activeOrders: activeOrders.length, products: products.length, lowStock: products.filter(p => p.stock <= p.minStock).length, shops: shops.filter(s => s.active).length, staff: users.filter(u => u.active && u.role !== 'customer').length });
});

admin.get('/products', async (_req, res) => { if (mongoDb()) return res.json(await mongoDb()!.collection<import('../models/domain').Product>('products').find({}).toArray()); return res.json(products); });
admin.get('/shops', async (_req, res) => { if (mongoDb()) return res.json(await listShops()); return res.json(shops); });
admin.get('/staff', async (_req, res) => { if (mongoDb()) return res.json(await listStaff()); return res.json(users.filter(u => u.role !== 'customer')); });
admin.get('/orders', async (_req, res) => { if (mongoDb()) return res.json(await findOrders()); return res.json(orders); });

admin.get('/onboarding/applications', async (req, res) => { const db = mongoDb(); if (!db) return res.status(503).json({ error: 'MongoDB is required for onboarding approvals' }); const type = typeof req.query.type === 'string' ? req.query.type : undefined; const status = typeof req.query.status === 'string' ? req.query.status : 'PENDING_REVIEW'; const applications = await db.collection('onboardingApplications').find({ ...(type && ['shopkeeper','employee'].includes(type)?{type:type as PartnerApplicationType}:{}), ...(status?{status}:{}) }).sort({submittedAt:-1}).limit(200).toArray(); return res.json(applications); });
admin.patch('/onboarding/applications/:referenceId/status', async (req,res) => { const db=mongoDb(); if(!db)return res.status(503).json({error:'MongoDB is required for onboarding approvals'}); const status=req.body?.status; if(!['APPROVED','REJECTED'].includes(status))return res.status(400).json({error:'Status must be APPROVED or REJECTED'}); const updated=await db.collection('onboardingApplications').findOneAndUpdate({referenceId:req.params.referenceId,status:'PENDING_REVIEW'},{$set:{status,reviewedBy:req.user!.id,reviewedAt:new Date().toISOString()}},{returnDocument:'after'}); if(!updated)return res.status(404).json({error:'Pending application not found'}); return res.json(updated); });

admin.get('/partner-credentials', async (req,res) => { const kind = req.query.kind === 'employee' ? 'employee' : 'shopkeeper'; try { await ensurePartnerCredentialPools(); return res.json({ kind, count: 100, credentials: await listPartnerCredentialPool(kind) }); } catch (error) { console.error(error); return res.status(503).json({ error: 'Unable to prepare credential pool' }); } });

admin.post('/onboarding/applications/:referenceId/assign-credential', async (req,res) => {
  const db=mongoDb(); if(!db)return res.status(503).json({error:'MongoDB is required for account assignment'});
  try { await ensurePartnerCredentialPools(); } catch { return res.status(503).json({error:'Credential pool is unavailable'}); }
  const application=await db.collection<any>('onboardingApplications').findOne({referenceId:req.params.referenceId,status:'APPROVED'});
  if(!application)return res.status(404).json({error:'Approved application not found'});
  if(application.activatedAt)return res.status(409).json({error:'This application already has an account'});
  const rawSuffix=String(req.body?.suffix??'').trim();
  if(!/^\d{1,4}$/.test(rawSuffix))return res.status(400).json({error:'Enter the last four-digit credential number'});
  const slot=Number(rawSuffix); if(slot<1||slot>100)return res.status(400).json({error:'Credential number must be between 0001 and 0100'});
  const shopId=typeof req.body?.shopId==='string'?req.body.shopId.trim():'';
  if(application.type==='shopkeeper'&&!shopId)return res.status(400).json({error:'Shop ID is required for a shopkeeper'});
  if(shopId&&!await db.collection('shops').findOne({id:shopId,active:true}))return res.status(400).json({error:'Active shop not found'});
  const kind=application.type as 'shopkeeper'|'employee';
  const loginId=`FC-${kind==='shopkeeper'?'SHOP':'EMP'}-${String(slot).padStart(4,'0')}`;
  const pool=await db.collection<any>('partnerCredentialPool').findOne({kind,slot,active:true});
  if(!pool)return res.status(404).json({error:'Credential slot not found'});
  if(pool.assignedToId)return res.status(409).json({error:'That four-digit credential is already assigned'});
  if(await db.collection<User>('users').findOne({username:loginId}))return res.status(409).json({error:'Credential login is already in use'});
  const claimed=await claimPartnerCredential(kind,slot,application.referenceId);
  if(!claimed)return res.status(409).json({error:'That credential was just assigned. Choose another four-digit number.'});
  const password=(await listPartnerCredentialPool(kind)).find(item=>item.slot===slot)?.password;
  if(!password) return res.status(503).json({error:'Credential password could not be recovered'});
  const user:User={id:`u-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name:application.fullName,email:application.email,phone:application.phone,username:loginId,role:kind,shopId:shopId||undefined,active:true,passwordHash:hashPassword(password)};
  try {
    await createUser(user);
    await db.collection('onboardingApplications').updateOne({referenceId:application.referenceId},{$set:{activatedAt:new Date().toISOString(),activatedBy:req.user!.id,userId:user.id,credentialSlot:slot,loginId}});
  } catch (error) {
    await db.collection('partnerCredentialPool').updateOne({kind,slot,assignedToId:application.referenceId},{$unset:{assignedToId:'',assignedAt:''}});
    throw error;
  }
  return res.status(201).json({ credentials:{ loginId, password, slot }, user:{id:user.id,name:user.name,role:user.role,shopId:user.shopId}, message:'Credential assigned. Share the login ID and password securely with the applicant.' });
});

admin.post('/onboarding/applications/:referenceId/activate', async (req,res) => {
  return res.status(410).json({error:'Manual username/password activation has been replaced. Approve the application, then assign a four-digit credential from Partner Credentials.'});
});

admin.get('/sales-imports', async (_req,res)=>{const db=mongoDb();if(!db)return res.status(503).json({error:'MongoDB is required for CSV approvals'});const imports=await db.collection<SalesImport>('salesImports').find({status:'PENDING_REVIEW'}).sort({submittedAt:-1}).limit(100).project({csv:0}).toArray();return res.json(imports);});
admin.post('/sales-imports/:referenceId/approve',async(req,res)=>{try{return res.json(await approveSalesImport(req.params.referenceId,req.user!.id));}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Unable to approve CSV'});}});
admin.post('/sales-imports/:referenceId/reject',async(req,res)=>{try{return res.json(await rejectSalesImport(req.params.referenceId,req.user!.id,typeof req.body?.reason==='string'?req.body.reason:'Rejected during admin review'));}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Unable to reject CSV'});}});
