const crypto = require('crypto');
const AuthService = require('./AuthService');
const knex = require('../db');
const roleModel = require('../../shared/role-model.json');

function getOAuthConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    const error = new Error('google_oauth_not_configured');
    error.status = 503;
    error.code = 'google_oauth_not_configured';
    throw error;
  }
  return { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET, redirectUri: GOOGLE_REDIRECT_URI };
}

function hashState(state) {
  return crypto.createHash('sha256').update(state).digest('hex');
}

function normalizeRegistrationIntent(registration) {
  if (!registration) return null;
  const personaId = AuthService.normalizePersonaId(registration.persona_id);
  const persona = AuthService.personas.find((entry) => entry.id === personaId);
  if (!persona || persona.id === 'super_admin') {
    const error = new Error('unknown_persona');
    error.status = 400;
    error.code = 'unknown_persona';
    throw error;
  }
  const coreRole = roleModel.coreRoles.find((entry) => entry.personas.includes(persona.id));
  if (!coreRole || (registration.core_role && registration.core_role !== coreRole.id)) {
    const error = new Error(coreRole ? 'persona_core_role_mismatch' : 'unknown_persona');
    error.status = 400;
    error.code = error.message;
    throw error;
  }
  const phone = String(registration.phone || '').trim().replace(/[^\d+]/g, '');
  if (!/^\+?[0-9]{9,15}$/.test(phone)) {
    const error = new Error('valid_phone_required');
    error.status = 400;
    error.code = 'valid_phone_required';
    throw error;
  }
  const invitationToken = String(registration.invitation_token || '').trim();
  if (persona.registration === 'invite' && !invitationToken) {
    const error = new Error('invitation_required_for_persona');
    error.status = 403;
    error.code = 'invitation_required_for_persona';
    throw error;
  }
  return {
    core_role: coreRole.id,
    persona_id: persona.id,
    phone,
    invitation_token_hash: invitationToken ? hashState(invitationToken) : null,
  };
}

function createAuthorizationRequest() {
  const config = getOAuthConfig();
  const state = crypto.randomBytes(32).toString('base64url');
  const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();
  return { state, stateHash: hashState(state), authorizationUrl: authorizationUrl.toString() };
}

async function consumeAuthorizationCode(code, registrationIntent = null) {
  if (!code || typeof fetch !== 'function') {
    const error = new Error('google_oauth_unavailable');
    error.status = 503;
    error.code = 'google_oauth_unavailable';
    throw error;
  }

  const config = getOAuthConfig();
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenResponse.ok) {
    const error = new Error('google_authorization_failed');
    error.status = 401;
    error.code = 'google_authorization_failed';
    throw error;
  }

  const tokens = await tokenResponse.json();
  if (!tokens.access_token) {
    const error = new Error('google_authorization_failed');
    error.status = 401;
    error.code = 'google_authorization_failed';
    throw error;
  }
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileResponse.ok) {
    const error = new Error('google_identity_invalid');
    error.status = 401;
    error.code = 'google_identity_invalid';
    throw error;
  }

  const profile = await profileResponse.json();
  if (profile.email_verified !== true || !profile.sub || !profile.email) {
    const error = new Error('google_email_not_verified');
    error.status = 403;
    error.code = 'google_email_not_verified';
    throw error;
  }

  const user = await AuthService.findOrCreateGoogleUser({
    sub: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    registration: registrationIntent,
  });
  return AuthService.createGoogleExchangeCode(user.user_id);
}

async function saveState(stateHash, registrationIntent = null) {
  await knex('auth_oauth_states').insert({
    state_hash: stateHash,
    registration_intent: registrationIntent || {},
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
  });
}

async function consumeState(stateHash) {
  return knex.transaction(async (transaction) => {
    const row = await transaction('auth_oauth_states')
      .where({ state_hash: stateHash })
      .andWhere('expires_at', '>', new Date())
      .forUpdate()
      .first();
    if (!row) return null;
    await transaction('auth_oauth_states').where({ state_hash: stateHash }).del();
    return row.registration_intent || null;
  });
}

module.exports = {
  consumeAuthorizationCode,
  consumeState,
  createAuthorizationRequest,
  hashState,
  normalizeRegistrationIntent,
  saveState,
};
