const express = require('express');
const router = express.Router();
const CyberThreatService = require('../services/CyberThreatService');
const { authenticate, requireAdmin } = require('../middleware/auth');

router.post('/scan', authenticate, async (req, res) => {
  try {
    const response = await CyberThreatService.scanEvent(req.body);
    res.json(response);
  } catch (err) {
    console.error('CyberThreatController.scan', err);
    res.status(500).json({ error: 'scan_error' });
  }
});

router.post('/configure', authenticate, requireAdmin, async (req, res) => {
  try {
    const response = await CyberThreatService.configureDetection({
      enabled: req.body.enabled,
      actorId: req.authUser.user_id,
    });
    res.json(response);
  } catch (err) {
    console.error('CyberThreatController.configure', err);
    res.status(500).json({ error: 'configure_error' });
  }
});

router.post('/status', authenticate, requireAdmin, async (req, res) => {
  try {
    const response = await CyberThreatService.getStatus();
    res.json(response);
  } catch (err) {
    console.error('CyberThreatController.status', err);
    res.status(500).json({ error: 'status_error' });
  }
});

module.exports = router;
