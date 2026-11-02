const express = require('express');
const router = express.Router();
const JichoService = require('../services/JichoService');
const db = require('../../../../db');

router.post('/scan', async (req, res) => {
  try {
    const result = await JichoService.diagnose(req.body);
    const farmerId = req.authUser.user_id;
    const [scan] = await db('jicho_scans').insert({
      farmer_id: farmerId,
      diagnosis: result.diagnosis,
      confidence: result.confidence,
      image_base64: req.body.image_base64,
      crop: req.body.crop || null,
      recommended_treatment: result.recommended_treatment,
    }).returning('*');
    res.json({ ...result, scan_id: scan.scan_id });
  } catch (err) {
    console.error('JichoController.scan', err);
    res.status(500).json({ error: 'jicho_error' });
  }
});

router.get('/scans', async (req, res) => {
  try {
    const scanQuery = db('jicho_scans').select('scan_id', 'diagnosis', 'confidence', 'crop', 'recommended_treatment', 'created_at');
    scanQuery.where('farmer_id', req.authUser.user_id);
    const scans = await scanQuery
      .orderBy('created_at', 'desc')
      .limit(20);
    res.json({ scans: scans.map((scan) => ({
      id: scan.scan_id,
      diagnosis: scan.diagnosis,
      confidence: Number(scan.confidence),
      farm: scan.crop || 'Current field',
      time: new Date(scan.created_at).toLocaleString(),
      severity: Number(scan.confidence) >= 0.9 ? 'high' : 'medium',
      recommended_treatment: scan.recommended_treatment,
    })) });
  } catch (err) {
    console.error('JichoController.history', err);
    res.status(500).json({ error: 'jicho_history_error' });
  }
});

module.exports = router;
