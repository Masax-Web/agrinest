const fs = require('fs');
const path = require('path');
require('dotenv').config();
const AuthService = require('./AuthService');

const STORE_PATH = path.join(__dirname, '..', 'data', 'cyber-threat-config.json');

function loadStore() {
  try {
    const json = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(json);
  } catch (err) {
    return { enabled: true, lastScan: null, incidents: [] };
  }
}

function saveStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function normalizeObject(obj) {
  if (!obj || typeof obj !== 'object') return {};
  return Object.entries(obj).reduce((acc, [key, value]) => {
    acc[key.toLowerCase()] = String(value).toLowerCase();
    return acc;
  }, {});
}

function analyzeEvent(eventData) {
  const data = normalizeObject(eventData);
  const text = Object.values(data).join(' ');
  const threatKeywords = [
    'port scan',
    'failed login',
    'ransomware',
    'malware',
    'ddos',
    'phishing',
    'unauthorized',
    'suspicious',
    'brute force',
    'exploit',
  ];
  const matches = threatKeywords.filter((keyword) => text.includes(keyword));
  const riskScore = Math.min(100, matches.length * 25 + (text.includes('critical') ? 20 : 0));
  const severity = riskScore >= 75 ? 'critical' : riskScore >= 40 ? 'high' : riskScore >= 15 ? 'medium' : 'low';
  const explanation = matches.length
    ? `Detected AI threat indicators: ${matches.join(', ')}.`
    : 'No obvious attack signatures detected; the model recommends continued monitoring.';

  return {
    threatDetected: severity !== 'low',
    severity,
    riskScore,
    explanation,
    model: 'ai-driven-threat-detector-v1',
  };
}

async function scanEvent(eventData) {
  const store = loadStore();
  if (!store.enabled) {
    return {
      success: false,
      enabled: false,
      message: 'Cyber threat detection is currently disabled by super admin.',
    };
  }

  const analysis = analyzeEvent(eventData);
  const incident = {
    id: `incident_${Date.now()}`,
    timestamp: new Date().toISOString(),
    eventData,
    analysis,
  };
  store.lastScan = incident;
  store.incidents.unshift(incident);
  saveStore(store);

  return {
    success: true,
    analysis,
    incidentId: incident.id,
  };
}

async function configureDetection({ enabled, actorId }) {
  const store = loadStore();
  store.enabled = Boolean(enabled);
  store.updatedAt = new Date().toISOString();
  saveStore(store);
  await AuthService.recordAdminAction({
    actorId,
    action: 'security_detection.configured',
    details: { enabled: store.enabled },
  });
  return {
    success: true,
    enabled: store.enabled,
  };
}

async function getStatus() {
  const store = loadStore();
  return {
    success: true,
    enabled: store.enabled,
    lastScan: store.lastScan,
    incidentCount: store.incidents.length,
  };
}

module.exports = {
  scanEvent,
  configureDetection,
  getStatus,
};
