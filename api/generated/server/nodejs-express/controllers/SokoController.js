const express = require('express');
const router = express.Router();
const ListingService = require('../services/ListingService');
const ProcurementService = require('../../../../services/ProcurementService');
const { authenticate } = require('../../../../middleware/auth');

function handleProcurementError(response, error, action) {
  if (error.status) return response.status(error.status).json({ error: error.message });
  console.error(`SokoController.${action}`, error);
  return response.status(500).json({ error: 'db_error' });
}

router.get('/rfqs', authenticate, async (req, res) => {
  try {
    const items = await ProcurementService.listRfqs(req.authUser.user_id);
    return res.json({ items });
  } catch (error) {
    return handleProcurementError(res, error, 'listRfqs');
  }
});

router.post('/rfqs', authenticate, async (req, res) => {
  try {
    const rfq = await ProcurementService.createRfq({
      buyerId: req.authUser.user_id,
      feedType: req.body.feed_type,
      quantityBags: req.body.quantity_bags,
      deliveryDate: req.body.required_delivery_date,
      specifications: req.body.specifications,
    });
    return res.status(201).json(rfq);
  } catch (error) {
    return handleProcurementError(res, error, 'createRfq');
  }
});

router.get('/rfqs/:rfqId/bids', authenticate, async (req, res) => {
  try {
    const items = await ProcurementService.listBids(req.params.rfqId, req.authUser.user_id);
    return res.json({ items });
  } catch (error) {
    return handleProcurementError(res, error, 'listBids');
  }
});

router.post('/rfqs/:rfqId/bids', authenticate, async (req, res) => {
  try {
    const bid = await ProcurementService.submitBid({
      rfqId: req.params.rfqId,
      supplierId: req.authUser.user_id,
      pricePerBag: req.body.price_per_bag,
      deliveryFee: req.body.delivery_fee,
      notes: req.body.notes,
    });
    return res.status(201).json(bid);
  } catch (error) {
    return handleProcurementError(res, error, 'submitBid');
  }
});

router.patch('/rfqs/:rfqId/bids/:bidId/accept', authenticate, async (req, res) => {
  try {
    const result = await ProcurementService.acceptBid({
      rfqId: req.params.rfqId,
      bidId: req.params.bidId,
      buyerId: req.authUser.user_id,
    });
    return res.json(result);
  } catch (error) {
    return handleProcurementError(res, error, 'acceptBid');
  }
});

router.patch('/rfqs/:rfqId/close', authenticate, async (req, res) => {
  try {
    const rfq = await ProcurementService.closeRfq({
      rfqId: req.params.rfqId,
      buyerId: req.authUser.user_id,
    });
    return res.json(rfq);
  } catch (error) {
    return handleProcurementError(res, error, 'closeRfq');
  }
});

router.post('/listings', authenticate, async (req, res) => {
  try {
    const listing = await ListingService.createListing({
      ...req.body,
      farmer_id: req.authUser.user_id,
      seller_name: req.authUser.name,
    });
    res.status(201).json(listing);
  } catch (err) {
    console.error('SokoController.createListing', err);
    res.status(500).json({ error: 'db_error' });
  }
});

router.get('/listings', async (req, res) => {
  try {
    const items = await ListingService.listings();
    res.json({ items });
  } catch (err) {
    console.error('SokoController.listings', err);
    res.status(500).json({ error: 'db_error' });
  }
});

router.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 12));
    const items = await ListingService.recentActivity(limit);
    res.json({ items });
  } catch (err) {
    console.error('SokoController.activity', err);
    res.status(500).json({ error: 'db_error' });
  }
});

router.post('/activity', authenticate, async (req, res) => {
  if (req.body.event_type !== 'cart_item_added') {
    return res.status(400).json({ error: 'unsupported_activity' });
  }
  try {
    const activity = await ListingService.createActivity(req.body.event_type, req.body.details);
    res.status(201).json(activity);
  } catch (err) {
    console.error('SokoController.createActivity', err);
    res.status(500).json({ error: 'db_error' });
  }
});

router.post('/orders', authenticate, async (req, res) => {
  try {
    const order = await ListingService.createOrder({ ...req.body, buyer_name: req.authUser.name });
    res.status(201).json(order);
  } catch (err) {
    console.error('SokoController.createOrder', err);
    res.status(500).json({ error: 'db_error' });
  }
});

router.get('/events', async (req, res) => {
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  let lastActivityId = Math.max(0, Number(req.headers['last-event-id'] || req.query.after) || 0);
  let isPolling = false;
  const send = (activity) => {
    res.write(`id: ${activity.activity_id}\nevent: market\ndata: ${JSON.stringify(activity)}\n\n`);
    lastActivityId = Number(activity.activity_id);
  };
  const poll = async () => {
    if (isPolling || res.writableEnded) return;
    isPolling = true;
    try {
      const events = await ListingService.activityAfter(lastActivityId);
      events.forEach(send);
    } catch (err) {
      console.error('SokoController.events', err);
    } finally {
      isPolling = false;
    }
  };
  res.write(': connected\n\n');
  await poll();
  const intervalId = setInterval(poll, 1500);
  const heartbeatId = setInterval(() => {
    if (!res.writableEnded) res.write(': heartbeat\n\n');
  }, 20000);
  res.on('close', () => {
    clearInterval(intervalId);
    clearInterval(heartbeatId);
  });
});

module.exports = router;
