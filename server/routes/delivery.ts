import { Router } from 'express';
import { orders, users } from '../store/memoryStore';
import { requireAuth, requireRole } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { findOrders, listDeliveryAssignments, listStaff, updateOrderStatus, upsertDeliveryAssignment, createNotification } from '../db/repositories';
import type { DeliveryAssignment, DeliveryPricing } from '../models/catalog';

export const delivery = Router();
delivery.use(requireAuth, requireRole('employee', 'shopkeeper', 'store_manager', 'admin', 'super_admin'));
const deliveryStatuses = ['ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'] as const;
const DEFAULT_PRICING: DeliveryPricing = { baseRatePerKm: 5, milestoneRatePerKm: 7, milestoneDeliveries: 50, updatedAt: new Date(0).toISOString(), updatedBy: 'system' };

async function getPricing(): Promise<DeliveryPricing> {
  const db = mongoDb();
  if (!db) return DEFAULT_PRICING;
  const saved = await db.collection<DeliveryPricing & { id?: string }>('deliverySettings').findOne({ id: 'pricing' });
  return saved ?? DEFAULT_PRICING;
}
async function completedCount(employeeId: string) { const db = mongoDb(); return db ? db.collection<DeliveryAssignment>('deliveryAssignments').countDocuments({ employeeId, status: 'DELIVERED' }) : 0; }

delivery.get('/pricing', async (_req, res) => res.json(await getPricing()));
delivery.put('/pricing', requireRole('admin', 'super_admin'), async (req, res) => {
  const baseRatePerKm = Number(req.body?.baseRatePerKm), milestoneRatePerKm = Number(req.body?.milestoneRatePerKm), milestoneDeliveries = Math.round(Number(req.body?.milestoneDeliveries));
  if (![baseRatePerKm,milestoneRatePerKm,milestoneDeliveries].every(Number.isFinite)||baseRatePerKm<=0||milestoneRatePerKm<=0||milestoneDeliveries<1||baseRatePerKm>1000||milestoneRatePerKm>1000||milestoneDeliveries>100000) return res.status(400).json({error:'Enter valid delivery pricing values'});
  const pricing: DeliveryPricing={baseRatePerKm,milestoneRatePerKm,milestoneDeliveries,updatedAt:new Date().toISOString(),updatedBy:req.user!.id}; const db=mongoDb(); if(db) await db.collection<DeliveryPricing & {id:string}>('deliverySettings').updateOne({id:'pricing'},{$set:{...pricing,id:'pricing'}},{upsert:true}); return res.json(pricing);
});
delivery.get('/earnings', requireRole('employee'), async (req,res)=>{
  const db=mongoDb(); if(!db) return res.json({completedDeliveries:0,totalDistanceKm:0,totalEarnings:0,currentRatePerKm:5,entries:[]});
  const pricing=await getPricing(); const assignments=await db.collection<DeliveryAssignment>('deliveryAssignments').find({employeeId:req.user!.id,status:'DELIVERED'}).sort({deliveredAt:-1}).limit(500).toArray();
  const totalDistanceKm=assignments.reduce((s,a)=>s+(a.distanceKm??0),0), totalEarnings=assignments.reduce((s,a)=>s+(a.earning??0),0), completedDeliveries=assignments.length, currentRatePerKm=completedDeliveries>=pricing.milestoneDeliveries?pricing.milestoneRatePerKm:pricing.baseRatePerKm;
  return res.json({completedDeliveries,totalDistanceKm,totalEarnings,currentRatePerKm,entries:assignments.map(a=>({orderId:a.orderId,distanceKm:a.distanceKm??0,ratePerKm:a.ratePerKm??pricing.baseRatePerKm,earning:a.earning??0,deliveredAt:a.deliveredAt}))});
});

delivery.get('/queue', async (req, res) => {
  const isAdmin = ['admin', 'super_admin'].includes(req.user!.role);
  if (mongoDb()) {
    const orderFilter = isAdmin ? { status: { $in: ['READY', 'OUT_FOR_DELIVERY'] } } : { shopId: req.user!.shopId, status: { $in: ['READY', 'OUT_FOR_DELIVERY'] } };
    const queued = await findOrders(orderFilter), assignments = await listDeliveryAssignments(isAdmin ? {} : { shopId: req.user!.shopId }), byOrder = new Map(assignments.map(a=>[a.orderId,a]));
    return res.json(queued.filter(order=>{const a=byOrder.get(order.id);return isAdmin||(a?.employeeId===req.user!.id)||(!a&&order.status==='READY'&&req.user!.role!=='employee')}).map(order=>{const a=byOrder.get(order.id);return {...order,deliveryStatus:a?.status,deliveryEmployeeId:a?.employeeId,distanceKm:a?.distanceKm,ratePerKm:a?.ratePerKm,earning:a?.earning};}));
  }
  return res.json(orders.filter(o=>(!req.user!.shopId||o.shopId===req.user!.shopId)&&['READY','OUT_FOR_DELIVERY'].includes(o.status)).map(o=>({...o,deliveryStatus:o.status==='READY'?'ASSIGNED':'OUT_FOR_DELIVERY'})));
});
delivery.get('/employees', async (req,res)=>{const isAdmin=['admin','super_admin'].includes(req.user!.role);if(mongoDb())return res.json(await listStaff(isAdmin?undefined:req.user!.shopId));return res.json(users.filter(u=>u.active&&['employee','shopkeeper','store_manager'].includes(u.role)&&(isAdmin||u.shopId===req.user!.shopId)).map(({id,name,phone,role,shopId})=>({id,name,phone,role,shopId})))});
delivery.get('/assignments', async (req,res)=>{const isAdmin=['admin','super_admin'].includes(req.user!.role);if(mongoDb())return res.json(await listDeliveryAssignments(isAdmin?{}:{shopId:req.user!.shopId}));return res.json([])});

delivery.post('/orders/:id/assign', async (req,res)=>{
  const employeeId=typeof req.body?.employeeId==='string'?req.body.employeeId:''; const distanceKm=Number(req.body?.distanceKm); if(!Number.isFinite(distanceKm)||distanceKm<=0||distanceKm>500)return res.status(400).json({error:'A valid delivery distance in kilometres is required'});
  if(mongoDb()){const db=mongoDb()!,order=await db.collection<import('../models/domain').Order>('orders').findOne({id:req.params.id});if(!order)return res.status(404).json({error:'Order not found'});const isAdmin=['admin','super_admin'].includes(req.user!.role);if(!isAdmin&&order.shopId!==req.user!.shopId)return res.status(403).json({error:'Order belongs to another shop'});if(order.status!=='READY')return res.status(400).json({error:'Only READY orders can be assigned'});const employee=await db.collection<import('../models/domain').User>('users').findOne({id:employeeId,active:true,role:'employee',shopId:order.shopId});if(!employee)return res.status(400).json({error:'Valid delivery employee is required'});const existing=await db.collection<DeliveryAssignment>('deliveryAssignments').findOne({orderId:order.id});if(existing&&existing.status!=='FAILED')return res.status(409).json({error:'Order already has an active delivery assignment'});const pricing=await getPricing(),done=await completedCount(employeeId),ratePerKm=done>=pricing.milestoneDeliveries?pricing.milestoneRatePerKm:pricing.baseRatePerKm,earning=Math.round(distanceKm*ratePerKm*100)/100;const assignment:DeliveryAssignment={id:existing?.id??`del-${Date.now()}`,orderId:order.id,shopId:order.shopId,employeeId,status:'ASSIGNED',assignedAt:new Date().toISOString(),distanceKm:Math.round(distanceKm*100)/100,ratePerKm,earning};await upsertDeliveryAssignment(assignment);await createNotification({id:`n-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,userId:employeeId,title:'New parcel delivery',message:`${order.id} is ready for delivery — ${distanceKm.toFixed(1)} km • estimated earnings ₹${earning.toFixed(2)} at ₹${ratePerKm}/km.`,type:'ORDER',read:false,createdAt:new Date().toISOString()});return res.json({order,assignment});}
  const order=orders.find(item=>item.id===req.params.id);if(!order)return res.status(404).json({error:'Order not found'});return res.json({order,assignment:{orderId:order.id,employeeId,shopId:order.shopId,status:'ASSIGNED',assignedAt:new Date().toISOString(),distanceKm,ratePerKm:5,earning:distanceKm*5}});
});

delivery.patch('/orders/:id/status', async (req,res)=>{const status=req.body?.status as typeof deliveryStatuses[number];if(!deliveryStatuses.includes(status))return res.status(400).json({error:'Invalid delivery status'});if(mongoDb()){const db=mongoDb()!,order=await db.collection<import('../models/domain').Order>('orders').findOne({id:req.params.id});if(!order)return res.status(404).json({error:'Order not found'});const isAdmin=['admin','super_admin'].includes(req.user!.role);if(!isAdmin&&order.shopId!==req.user!.shopId)return res.status(403).json({error:'Insufficient permissions'});const assignment=await db.collection<DeliveryAssignment>('deliveryAssignments').findOne({orderId:order.id});if(!assignment)return res.status(409).json({error:'Order has no delivery assignment'});if(!isAdmin&&assignment.employeeId!==req.user!.id)return res.status(403).json({error:'Delivery is assigned to another employee'});const validTransition=(from:DeliveryAssignment['status'],to:typeof deliveryStatuses[number])=>({ASSIGNED:['PICKED_UP','FAILED'],PICKED_UP:['OUT_FOR_DELIVERY','FAILED'],OUT_FOR_DELIVERY:['DELIVERED','FAILED'],DELIVERED:[],FAILED:[]} as Record<DeliveryAssignment['status'],string[]>)[from].includes(to);if(!validTransition(assignment.status,status))return res.status(409).json({error:`Invalid delivery transition from ${assignment.status} to ${status}`});const orderStatus=status==='PICKED_UP'||status==='OUT_FOR_DELIVERY'?'OUT_FOR_DELIVERY':status==='DELIVERED'?'DELIVERED':status==='FAILED'?'CANCELLED':order.status;const updated=await updateOrderStatus(order.id,orderStatus);const updatedAssignment={...assignment,status,...(status==='DELIVERED'?{deliveredAt:new Date().toISOString()}: {})};await upsertDeliveryAssignment(updatedAssignment);if(status==='DELIVERED')await createNotification({id:`n-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,userId:assignment.employeeId!,title:'Delivery completed',message:`${order.id} completed — ₹${(assignment.earning??0).toFixed(2)} earned for ${assignment.distanceKm??0} km.`,type:'PAYMENT',read:false,createdAt:new Date().toISOString()});return res.json({...updated,deliveryStatus:status,deliveryEmployeeId:assignment.employeeId,distanceKm:assignment.distanceKm,ratePerKm:assignment.ratePerKm,earning:assignment.earning});}const order=orders.find(item=>item.id===req.params.id);if(!order)return res.status(404).json({error:'Order not found'});if(status==='DELIVERED')order.status='DELIVERED';if(status==='FAILED')order.status='CANCELLED';if(status==='PICKED_UP'||status==='OUT_FOR_DELIVERY')order.status='OUT_FOR_DELIVERY';return res.json(order);});
