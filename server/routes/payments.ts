import { Router } from 'express';
import { requireAuth } from '../auth/middleware';
import { mongoDb } from '../db/mongodb';
import { payments, orders } from '../store/memoryStore';
import { createRazorpayOrder, fetchRazorpayPayment, verifyPaymentSignature, verifyWebhookSignature } from '../payments/razorpay';
import type { Payment } from '../models/catalog';
import type { Order } from '../models/domain';

export const paymentsRouter = Router();

paymentsRouter.post('/create-order', requireAuth, async (req, res) => {
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Only customers can create payment orders' });
  const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
  if (!orderId) return res.status(400).json({ error: 'orderId is required' });
  if (mongoDb()) {
    const db = mongoDb()!;
    const order = await db.collection<Order>('orders').findOne({ id: orderId, customerId: req.user.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.paymentMethod === 'COD') return res.status(400).json({ error: 'COD orders do not require online payment' });
    if (order.status === 'CANCELLED') return res.status(409).json({ error: 'Cancelled order cannot be paid' });
    const payment = await db.collection<Payment>('payments').findOne({ orderId });
    if (!payment) return res.status(404).json({ error: 'Payment record not found' });
    if (payment.status === 'PAID') return res.status(409).json({ error: 'Order is already paid' });
    const paymentDoc = payment as Payment & { providerOrderId?: string };
    if (paymentDoc.providerOrderId) return res.json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: paymentDoc.providerOrderId, amount: Math.round(order.total * 100), currency: 'INR' });
    try {
      const razorpayOrder = await createRazorpayOrder({ amount: order.total, receipt: order.id });
      await db.collection('payments').updateOne({ orderId }, { $set: { provider: 'razorpay', providerOrderId: razorpayOrder.id, status: 'PENDING' } });
      return res.status(201).json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency });
    } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to create payment order' }); }
  }
  const order = orders.find(item => item.id === orderId && item.customerId === req.user!.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.paymentMethod === 'COD') return res.status(400).json({ error: 'COD orders do not require online payment' });
  const payment = payments.find(item => item.orderId === orderId);
  if (!payment) return res.status(404).json({ error: 'Payment record not found' });
  try {
    const razorpayOrder = await createRazorpayOrder({ amount: order.total, receipt: order.id });
    (payment as Payment & { providerOrderId?: string }).providerOrderId = razorpayOrder.id;
    payment.provider = 'razorpay';
    return res.status(201).json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency });
  } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to create payment order' }); }
});

paymentsRouter.post('/verify', requireAuth, async (req, res) => {
  if (req.user?.role !== 'customer') return res.status(403).json({ error: 'Only customers can verify payments' });
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body ?? {};
  if (![orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature].every(value => typeof value === 'string' && value.trim())) return res.status(400).json({ error: 'Complete payment verification fields are required' });
  if (mongoDb()) {
    const db = mongoDb()!;
    const order = await db.collection<Order>('orders').findOne({ id: orderId, customerId: req.user.id });
    const payment = await db.collection<Payment>('payments').findOne({ orderId });
    if (!order || !payment) return res.status(404).json({ error: 'Order or payment not found' });
    const paymentDoc = payment as Payment & { providerOrderId?: string };
    if (paymentDoc.providerOrderId !== razorpayOrderId) return res.status(400).json({ error: 'Payment order mismatch' });
    if (!verifyPaymentSignature(paymentDoc.providerOrderId, razorpayPaymentId, razorpaySignature)) return res.status(400).json({ error: 'Invalid payment signature' });
    try {
      const gatewayPayment = await fetchRazorpayPayment(razorpayPaymentId);
      if (gatewayPayment.order_id !== paymentDoc.providerOrderId) return res.status(400).json({ error: 'Gateway payment order mismatch' });
      if (gatewayPayment.amount !== Math.round(order.total * 100) || gatewayPayment.currency !== 'INR') return res.status(400).json({ error: 'Gateway payment amount mismatch' });
      if (gatewayPayment.status !== 'captured') return res.status(409).json({ error: `Payment is not captured (${gatewayPayment.status})` });
      await db.collection('payments').updateOne({ orderId }, { $set: { status: 'PAID', provider: 'razorpay', providerPaymentId: razorpayPaymentId } });
      return res.json({ ok: true, orderId, paymentId: razorpayPaymentId, status: 'PAID' });
    } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : 'Unable to verify gateway payment' }); }
  }
  const order = orders.find(item => item.id === orderId && item.customerId === req.user!.id);
  const payment = payments.find(item => item.orderId === orderId);
  const paymentDoc = payment as (Payment & { providerOrderId?: string }) | undefined;
  if (!order || !paymentDoc || paymentDoc.providerOrderId !== razorpayOrderId) return res.status(404).json({ error: 'Order or payment not found' });
  if (!verifyPaymentSignature(paymentDoc.providerOrderId!, razorpayPaymentId, razorpaySignature)) return res.status(400).json({ error: 'Invalid payment signature' });
  paymentDoc.status = 'PAID'; paymentDoc.provider = 'razorpay'; paymentDoc.providerPaymentId = razorpayPaymentId;
  return res.json({ ok: true, orderId, paymentId: razorpayPaymentId, status: 'PAID' });
});

export const paymentWebhook = Router();
paymentWebhook.post('/', async (req, res) => {
  const signature = req.header('X-Razorpay-Signature');
  const eventId = req.header('x-razorpay-event-id');
  if (!signature || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'Invalid webhook request' });
  const rawBody = req.body.toString('utf8');
  if (!verifyWebhookSignature(rawBody, signature)) return res.status(400).json({ error: 'Invalid webhook signature' });
  let payload: { event?: string; payload?: { payment?: { entity?: { order_id?: string } }; order?: { entity?: { id?: string } } } };
  try { payload = JSON.parse(rawBody); } catch { return res.status(400).json({ error: 'Invalid webhook JSON' }); }
  if (!eventId) return res.status(200).json({ ok: true });
  const event = payload.event ?? '';
  const razorpayOrderId = payload.payload?.payment?.entity?.order_id ?? payload.payload?.order?.entity?.id;
  if (mongoDb() && razorpayOrderId) {
    const db = mongoDb()!;
    const existingEvent = await db.collection('paymentWebhookEvents').findOne({ eventId });
    if (existingEvent) return res.status(200).json({ ok: true, duplicate: true });
    await db.collection('paymentWebhookEvents').insertOne({ eventId, event, receivedAt: new Date().toISOString() });
    if (event === 'payment.captured' || event === 'order.paid') await db.collection('payments').updateOne({ providerOrderId: razorpayOrderId }, { $set: { status: 'PAID', provider: 'razorpay' } });
    else if (event === 'payment.failed') await db.collection('payments').updateOne({ providerOrderId: razorpayOrderId }, { $set: { status: 'FAILED', provider: 'razorpay' } });
  }
  return res.status(200).json({ ok: true });
});
