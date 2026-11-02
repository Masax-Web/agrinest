const DEFAULT_MODEL = 'linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification';
const PlatformSettingsService = require('./PlatformSettingsService');

function parseImageData(imageBase64) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(imageBase64 || '');
  if (!match) throw new Error('image_base64 must be a data URL containing a base64 image');
  return { contentType: match[1], buffer: Buffer.from(match[2], 'base64') };
}

function treatmentFor(label) {
  const normalized = label.toLowerCase();
  if (normalized.includes('healthy')) return 'Continue current crop care and monitor new growth.';
  if (normalized.includes('rust')) return 'Remove heavily affected leaves, improve airflow, and consult an agronomist about a labelled fungicide.';
  if (normalized.includes('blight')) return 'Isolate affected plants, avoid overhead irrigation, and follow the local fungicide label.';
  if (normalized.includes('virus') || normalized.includes('mosaic')) return 'Remove symptomatic plants, control vectors, and avoid saving seed from affected plants.';
  if (normalized.includes('mite') || normalized.includes('spider')) return 'Inspect leaf undersides, reduce plant stress, and use a labelled integrated pest treatment.';
  return 'Confirm the result with an agronomist and follow the product label before treatment.';
}

async function diagnoseImage(imageBase64) {
  if (!await PlatformSettingsService.isIntegrationEnabled('crop_diagnosis')) {
    throw new Error('crop_diagnosis_integration_disabled');
  }
  const apiKey = process.env.HF_API_KEY;
  if (!apiKey) throw new Error('HF_API_KEY is not configured for Jicho vision inference');

  const model = process.env.HF_VISION_MODEL || DEFAULT_MODEL;
  const { contentType, buffer } = parseImageData(imageBase64);
  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': contentType,
    },
    body: buffer,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Vision model request failed with ${response.status}`);
  if (!Array.isArray(payload) || !payload[0]?.label) throw new Error('Vision model returned no classification labels');

  const top = payload[0];
  const confidence = Number(top.score || 0);
  return {
    diagnosis: top.label,
    confidence: Number(confidence.toFixed(4)),
    severity: top.label.toLowerCase().includes('healthy') ? 'low' : confidence >= 0.8 ? 'high' : 'medium',
    recommended_treatment: treatmentFor(top.label),
    model,
  };
}

module.exports = { diagnoseImage };
