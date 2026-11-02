const express = require('express');
const router = express.Router();
const CommunicationsService = require('../services/CommunicationsService');
const { authenticate } = require('../middleware/auth');

router.post('/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text } = req.body;
    const response = await CommunicationsService.handleUssdSession({ sessionId, phoneNumber, text });
    res.json(response);
  } catch (err) {
    console.error('CommunicationsController.ussd', err);
    res.status(500).json({ error: 'ussd_error' });
  }
});

router.post('/sms/send', authenticate, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    const response = await CommunicationsService.sendSms([phoneNumber], message);
    res.json(response);
  } catch (err) {
    console.error('CommunicationsController.sms', err);
    res.status(500).json({ error: 'sms_error' });
  }
});

router.post('/voice/call', authenticate, async (req, res) => {
  try {
    const { phoneNumber, voiceMessage } = req.body;
    const response = await CommunicationsService.sendVoiceCall({ phoneNumber, voiceMessage });
    res.json(response);
  } catch (err) {
    console.error('CommunicationsController.voice', err);
    res.status(500).json({ error: 'voice_error' });
  }
});

router.post('/airtime/topup', authenticate, async (req, res) => {
  try {
    const { phoneNumber, amount } = req.body;
    const response = await CommunicationsService.sendAirtimeTopup({ phoneNumber, amount });
    res.json(response);
  } catch (err) {
    console.error('CommunicationsController.airtime', err);
    res.status(500).json({ error: 'airtime_error' });
  }
});

router.post('/google/login', async (req, res) => {
  res.status(410).json({ error: 'use_verified_google_oauth' });
});

module.exports = router;
