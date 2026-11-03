const fs = require('fs');
const path = require('path');
require('dotenv').config();
const knex = require('../db');
const PlatformSettingsService = require('./PlatformSettingsService');

const STORE_PATH = path.join(__dirname, '..', 'data', 'communications-store.json');

function loadStore() {
  try {
    const json = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(json);
  } catch (err) {
    return { ussdSessions: {}, users: [], events: [] };
  }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function findUserByPhone(phone) {
  if (!phone) return null;
  const store = loadStore();
  return store.users.find((user) => user.phone === phone || user.phone === normalizePhone(phone));
}

function normalizePhone(phone) {
  return phone.replace(/[^0-9+]/g, '');
}

async function handleUssdSession({ sessionId, phoneNumber, text = '' }) {
  const store = loadStore();
  const normalizedPhone = normalizePhone(phoneNumber || '');
  const sessionKey = sessionId || normalizedPhone;
  const session = store.ussdSessions[sessionKey] || { sessionId: sessionKey, phoneNumber: normalizedPhone, step: 0, answers: [] };
  const trimmedText = text.trim();
  const parts = trimmedText === '' ? [] : trimmedText.split('*').map((v) => v.trim());

  let response;
  let endSession = false;

  if (parts.length === 0) {
    response = `AGRI-NEST\n1. Register as a farmer\n2. Farmer help & tips\n3. Track registration status`;
  } else if (parts[0] === '1') {
    if (parts.length === 1) {
      response = 'Welcome! Please enter your full name:';
      session.step = 1;
    } else if (parts.length === 2) {
      response = 'Enter your district or nearest town:';
      session.step = 2;
      session.answers = [parts[1]];
    } else if (parts.length === 3) {
      response = 'Which crop do you grow most? e.g. maize, beans, dairy:';
      session.step = 3;
      session.answers = [parts[1], parts[2]];
    } else if (parts.length === 4) {
      const [name, location, crop] = [parts[1], parts[2], parts[3]];
      const newUser = registerUssdUser({ phone: normalizedPhone, name, location, crop });
      response = `Thanks ${name}! Your farmer profile is now active. You can use this phone number to login to the marketplace later.`;
      endSession = true;
      session.step = 4;
      session.answers = [name, location, crop];
      store.events.unshift({
        id: `evt_${Date.now()}`,
        type: 'ussd_registration',
        timestamp: new Date().toISOString(),
        phone: normalizedPhone,
        name,
        location,
        crop,
      });
      await notifyAdmins('new_ussd_registration', { phone: normalizedPhone, name, location, crop });
    } else {
      response = 'Invalid choice. Dial *123# again to start over.';
      endSession = true;
    }
  } else if (parts[0] === '2') {
    response = 'Farmer help: reply with 1 for market prices, 2 for weather tips, 3 for voice guidance.';
  } else if (parts[0] === '3') {
    const user = findUserByPhone(normalizedPhone);
    if (user) {
      response = `Your profile is active. Name: ${user.name}, Location: ${user.location || 'unknown'}, Main crop: ${user.crop || 'unknown'}`;
    } else {
      response = 'No registration found. Dial *123# and choose 1 to register.';
    }
    endSession = true;
  } else {
    response = 'Invalid option. Dial *123# again to start.';
    endSession = true;
  }

  store.ussdSessions[sessionKey] = session;
  saveStore(store);
  return { message: response, endSession };
}

function registerUssdUser({ phone, name, location, crop }) {
  const store = loadStore();
  const existing = store.users.find((user) => user.phone === phone);
  if (existing) {
    Object.assign(existing, { name, location, crop, deviceType: 'feature-phone', updatedAt: new Date().toISOString() });
    saveStore(store);
    return existing;
  }

  const newUser = {
    id: `usr_${Date.now()}`,
    phone,
    name,
    location,
    crop,
    role: 'farmer',
    deviceType: 'feature-phone',
    verified: false,
    createdAt: new Date().toISOString(),
  };
  store.users.push(newUser);
  saveStore(store);
  return newUser;
}

async function notifyAdmins(event, payload) {
  const message = `${event} event recorded for AGRI-NEST: ${JSON.stringify(payload)}`;
  const admins = await knex('users').select('email', 'phone')
    .where({ role: 'admin', persona_id: 'super_admin', role_status: 'active' });
  const emails = admins.map((admin) => admin.email).filter(Boolean);
  const phones = admins.map((admin) => admin.phone).filter(Boolean);
  const notifications = [];
  if (emails.length) notifications.push(sendEmail(emails, `AGRI-NEST ${event}`, message));
  if (phones.length) notifications.push(sendSms(phones, message));
  await Promise.all(notifications);
  return { success: true };
}

async function sendEmail(recipients, subject, body) {
  if (!await PlatformSettingsService.isIntegrationEnabled('email')) {
    return { success: false, reason: 'email_integration_disabled' };
  }
  if (!process.env.SMTP_HOST) {
    console.log('[CommunicationsService] Email stub:', { recipients, subject, body });
    return { success: false, reason: 'smtp_not_configured' };
  }

  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'no-reply@agri-nest.com',
      to: recipients.join(','),
      subject,
      text: body,
    });

    return { success: true };
  } catch (error) {
    console.error('[CommunicationsService] sendEmail error', error);
    return { success: false, error: error.message };
  }
}

async function sendSms(recipients, message) {
  if (!await PlatformSettingsService.isIntegrationEnabled('sms')) {
    return { success: false, reason: 'sms_integration_disabled' };
  }
  if (process.env.SMS_API_URL) {
    try {
      const response = await fetch(process.env.SMS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.SMS_API_KEY ? { Authorization: `Bearer ${process.env.SMS_API_KEY}` } : {}),
        },
        body: JSON.stringify({ to: recipients, message }),
      });
      const json = await response.json();
      return { success: response.ok, response: json };
    } catch (error) {
      console.error('[CommunicationsService] sendSms error', error);
      return { success: false, error: error.message };
    }
  }

  console.log('[CommunicationsService] SMS stub:', { recipients, message });
  return { success: false, reason: 'sms_not_configured' };
}

async function sendVoiceCall({ phoneNumber, voiceMessage }) {
  if (!await PlatformSettingsService.isIntegrationEnabled('voice')) {
    return { success: false, reason: 'voice_integration_disabled' };
  }
  const payload = { to: phoneNumber, message: voiceMessage, event: 'voice_call' };
  if (process.env.VOICE_API_URL) {
    try {
      const response = await fetch(process.env.VOICE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.VOICE_API_KEY ? { Authorization: `Bearer ${process.env.VOICE_API_KEY}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return { success: response.ok, response: json };
    } catch (error) {
      console.error('[CommunicationsService] sendVoiceCall error', error);
      return { success: false, error: error.message };
    }
  }

  console.log('[CommunicationsService] Voice call stub:', payload);
  return { success: false, reason: 'voice_not_configured' };
}

async function sendAirtimeTopup({ phoneNumber, amount }) {
  if (!await PlatformSettingsService.isIntegrationEnabled('airtime')) {
    return { success: false, reason: 'airtime_integration_disabled' };
  }
  const payload = { to: phoneNumber, amount, event: 'airtime_topup' };
  if (process.env.AIRTIME_API_URL) {
    try {
      const response = await fetch(process.env.AIRTIME_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.AIRTIME_API_KEY ? { Authorization: `Bearer ${process.env.AIRTIME_API_KEY}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      return { success: response.ok, response: json };
    } catch (error) {
      console.error('[CommunicationsService] sendAirtimeTopup error', error);
      return { success: false, error: error.message };
    }
  }

  console.log('[CommunicationsService] Airtime topup stub:', payload);
  return { success: false, reason: 'airtime_not_configured' };
}

module.exports = {
  handleUssdSession,
  notifyAdmins,
  sendSms,
  sendVoiceCall,
  sendAirtimeTopup,
};
