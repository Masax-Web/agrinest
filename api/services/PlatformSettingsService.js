const knex = require('../db');

const integrationDefinitions = {
  email: { label: 'Email', configured: () => Boolean(process.env.SMTP_HOST) },
  sms: { label: 'SMS', configured: () => Boolean(process.env.SMS_API_URL) },
  voice: { label: 'Voice', configured: () => Boolean(process.env.VOICE_API_URL) },
  airtime: { label: 'Airtime', configured: () => Boolean(process.env.AIRTIME_API_URL) },
  crop_diagnosis: { label: 'Crop diagnosis', configured: () => Boolean(process.env.HF_API_KEY) },
};

async function getIntegrations() {
  const rows = await knex('auth_integration_settings').select('integration_id', 'enabled');
  const settings = new Map(rows.map((row) => [row.integration_id, row.enabled]));
  return Object.entries(integrationDefinitions).map(([id, definition]) => ({
    id,
    label: definition.label,
    configured: definition.configured(),
    enabled: settings.get(id) ?? true,
  }));
}

async function isIntegrationEnabled(id) {
  if (!integrationDefinitions[id]) throw new Error(`Unknown integration: ${id}`);
  const row = await knex('auth_integration_settings').where({ integration_id: id }).first();
  return row ? row.enabled : true;
}

async function setIntegrationEnabled({ id, enabled, actorId }) {
  if (!integrationDefinitions[id] || typeof enabled !== 'boolean') {
    const error = new Error('invalid_integration_setting');
    error.status = 400;
    error.code = 'invalid_integration_setting';
    throw error;
  }
  await knex('auth_integration_settings').insert({
    integration_id: id,
    enabled,
    updated_by: actorId,
    updated_at: new Date(),
  }).onConflict('integration_id').merge({
    enabled,
    updated_by: actorId,
    updated_at: new Date(),
  });
  return (await getIntegrations()).find((integration) => integration.id === id);
}

module.exports = { getIntegrations, isIntegrationEnabled, setIntegrationEnabled };
