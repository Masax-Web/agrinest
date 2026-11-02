const express = require('express');
const router = express.Router();
const ListingService = require('../services/ListingService');
const { authenticate } = require('../../../../middleware/auth');

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
