import { MongoClient } from 'mongodb';
export async function ensureIndexes(client: MongoClient) {
  const db=client.db(process.env.MONGODB_DB||'freshcart');
  try{await db.collection('users').dropIndex('email_1');}catch{}
  await Promise.all([
    db.collection('users').createIndex({email:1}),db.collection('users').createIndex({phone:1},{unique:true,sparse:true}),
    db.collection('shops').createIndex({active:1}),db.collection('products').createIndex({shopId:1,category:1,active:1}),db.collection('products').createIndex({barcode:1},{unique:true,sparse:true}),db.collection('products').createIndex({name:'text',sku:'text'}),
    db.collection('orders').createIndex({customerId:1,createdAt:-1}),db.collection('orders').createIndex({shopId:1,status:1,createdAt:-1}),db.collection('orders').createIndex({'items.productId':1,createdAt:-1}),db.collection('orders').createIndex({customerId:1,idempotencyKey:1},{unique:true,sparse:true}),
    db.collection('addresses').createIndex({userId:1,isDefault:-1}),db.collection('wishlist').createIndex({userId:1,productId:1},{unique:true}),db.collection('offers').createIndex({code:1},{unique:true}),db.collection('payments').createIndex({orderId:1},{unique:true}),db.collection('payments').createIndex({providerOrderId:1},{unique:true,sparse:true}),
    db.collection('paymentWebhookEvents').createIndex({eventId:1},{unique:true}),db.collection('paymentWebhookEvents').createIndex({receivedAt:-1}),db.collection('deliveryAssignments').createIndex({orderId:1},{unique:true}),db.collection('deliveryAssignments').createIndex({employeeId:1,status:1}),db.collection('notifications').createIndex({userId:1,read:1,createdAt:-1}),db.collection('attendance').createIndex({userId:1,date:1},{unique:true}),db.collection('auditLogs').createIndex({actorId:1,createdAt:-1}),db.collection('auditLogs').createIndex({entity:1,entityId:1,createdAt:-1}),
    db.collection('shopSettings').createIndex({shopId:1},{unique:true}),db.collection('systemSettings').createIndex({id:1},{unique:true}),db.collection('proofOfDelivery').createIndex({orderId:1,createdAt:-1}),db.collection('recentlyViewed').createIndex({userId:1,viewedAt:-1}),db.collection('recentlyViewed').createIndex({userId:1,productId:1},{unique:true})
  ]);
}
