const crypto = require('crypto');
const AuthService = require('./AuthService');
const knex = require('../db');

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

async function consumeAuthorizationCode(code) {
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
  });
  return AuthService.createGoogleExchangeCode(user.user_id);
}

async function saveState(stateHash) {
  await knex('auth_oauth_states').insert({
    state_hash: stateHash,
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
    if (!row) return false;
    await transaction('auth_oauth_states').where({ state_hash: stateHash }).del();
    return true;
  });
}

module.exports = {
  consumeAuthorizationCode,
  consumeState,
  createAuthorizationRequest,
  hashState,
  saveState,
};
