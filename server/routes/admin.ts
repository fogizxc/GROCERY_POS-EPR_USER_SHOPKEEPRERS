import { Router } from 'express';
import { products, orders, shops, users } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { createUser, findOrders, listShops, listStaff } from '../db/repositories';
import { hashPassword, isStrongPassword } from '../auth/password';
import { adminCatalog } from './adminCatalog';
import { approveSalesImport, rejectSalesImport } from './onboarding';
import type { PartnerApplicationType } from './onboarding';
import type { SalesImport, User } from '../models/domain';

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

admin.post('/onboarding/applications/:referenceId/activate', async (req,res) => {
  const db=mongoDb(); if(!db)return res.status(503).json({error:'MongoDB is required for account activation'});
  const application=await db.collection<any>('onboardingApplications').findOne({referenceId:req.params.referenceId,status:'APPROVED'});
  if(!application)return res.status(404).json({error:'Approved application not found'});
  const username=typeof req.body?.username==='string'?req.body.username.trim().toLowerCase():'';
  const password=typeof req.body?.password==='string'?req.body.password:'';
  const shopId=typeof req.body?.shopId==='string'?req.body.shopId.trim():'';
  if(!/^[a-z0-9._-]{4,40}$/.test(username))return res.status(400).json({error:'Username must be 4-40 characters using letters, numbers, dot, underscore or hyphen'});
  if(!isStrongPassword(password))return res.status(400).json({error:'Password must be 8-128 characters and contain letters and numbers'});
  if(application.type==='shopkeeper'&&!shopId)return res.status(400).json({error:'Shop ID is required for a shopkeeper account'});
  if(shopId&&!await db.collection('shops').findOne({id:shopId,active:true}))return res.status(400).json({error:'Active shop not found'});
  if(await db.collection<User>('users').findOne({username}))return res.status(409).json({error:'That login ID is already in use'});
  const user:User={id:`u-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name:application.fullName,email:application.email,phone:application.phone,username,role:application.type==='shopkeeper'?'shopkeeper':'employee',shopId:shopId||undefined,active:true,passwordHash:hashPassword(password)};
  await createUser(user);
  await db.collection('onboardingApplications').updateOne({referenceId:application.referenceId},{$set:{activatedAt:new Date().toISOString(),activatedBy:req.user!.id,userId:user.id}});
  return res.status(201).json({user:{id:user.id,name:user.name,email:user.email,phone:user.phone,username:user.username,role:user.role,shopId:user.shopId,active:user.active},message:'Account activated. Share the login ID and password securely with the applicant.'});
});

admin.get('/sales-imports', async (_req,res)=>{const db=mongoDb();if(!db)return res.status(503).json({error:'MongoDB is required for CSV approvals'});const imports=await db.collection<SalesImport>('salesImports').find({status:'PENDING_REVIEW'}).sort({submittedAt:-1}).limit(100).project({csv:0}).toArray();return res.json(imports);});
admin.post('/sales-imports/:referenceId/approve',async(req,res)=>{try{return res.json(await approveSalesImport(req.params.referenceId,req.user!.id));}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Unable to approve CSV'});}});
admin.post('/sales-imports/:referenceId/reject',async(req,res)=>{try{return res.json(await rejectSalesImport(req.params.referenceId,req.user!.id,typeof req.body?.reason==='string'?req.body.reason:'Rejected during admin review'));}catch(error){return res.status(400).json({error:error instanceof Error?error.message:'Unable to reject CSV'});}});
