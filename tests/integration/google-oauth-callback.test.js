const request = require('supertest');
const { expect } = require('chai');
const app = require('../../api/generated/server/nodejs-express/app');
const GoogleOAuthService = require('../../api/services/GoogleOAuthService');

describe('Google OAuth callback', () => {
  const originalMethods = {};
  let originalOAuthEnv;

  beforeEach(() => {
    originalOAuthEnv = Object.fromEntries(
      ['APP_BASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']
        .map((key) => [key, process.env[key]]),
    );
  });

  afterEach(() => {
    for (const [method, implementation] of Object.entries(originalMethods)) {
      GoogleOAuthService[method] = implementation;
    }
    for (const [key, value] of Object.entries(originalOAuthEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('returns Google start configuration errors to the app instead of showing a raw API error', async () => {
    const previousEnv = {
      APP_BASE_URL: process.env.APP_BASE_URL,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    };
    process.env.APP_BASE_URL = 'https://agrinest.example';
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_REDIRECT_URI;

    try {
      const response = await request(app)
        .get('/auth/google')
        .expect(302);

      expect(response.headers.location).to.equal(
        'https://agrinest.example/?auth_error=google_oauth_not_configured'
      );
    } finally {
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('accepts Google callback query parameters and validates the state in the handler', async () => {
    process.env.APP_BASE_URL = 'https://agrinest.example';

    const response = await request(app)
      .get('/auth/google/callback')
      .query({
        state: 'google-state',
        code: 'google-code',
        iss: 'https://accounts.google.com',
        scope: 'email profile openid',
        authuser: '0',
        prompt: 'consent',
      })
      .expect(302);

    expect(response.headers.location).to.equal(
      'https://agrinest.example/?auth_error=google_state_invalid'
    );
  });

  it('stores the selected persona and hashes invitation tokens in OAuth state', async () => {
    originalMethods.createAuthorizationRequest = GoogleOAuthService.createAuthorizationRequest;
    originalMethods.saveState = GoogleOAuthService.saveState;
    GoogleOAuthService.createAuthorizationRequest = () => ({
      state: 'registration-state',
      stateHash: 'registration-state-hash',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=registration-state',
    });
    let savedState;
    GoogleOAuthService.saveState = async (...args) => { savedState = args; };

    const response = await request(app)
      .post('/auth/google/start')
      .send({
        registration: {
          persona_id: 'partnership_manager',
          phone: '+255 712 345 678',
          invitation_token: 'one-time-invite-token',
        },
      })
      .expect(200);

    expect(response.body.authorization_url).to.include('accounts.google.com');
    expect(savedState[0]).to.equal('registration-state-hash');
    expect(savedState[1]).to.deep.equal({
      core_role: 'admin',
      persona_id: 'partnership_manager',
      phone: '+255712345678',
      invitation_token_hash: GoogleOAuthService.hashState('one-time-invite-token'),
    });
    expect(JSON.stringify(savedState)).not.to.include('one-time-invite-token');
    expect(response.headers['set-cookie'][0]).to.include('agrinest_oauth_state=registration-state');
  });

  it('rejects invited personas without an invitation before redirecting to Google', async () => {
    const response = await request(app)
      .post('/auth/google/start')
      .send({
        registration: {
          persona_id: 'partnership_manager',
          phone: '+255712345678',
        },
      })
      .expect(403);

    expect(response.body.error).to.equal('invitation_required_for_persona');
  });

  it('rejects Google registration when the persona does not belong to the selected core role', async () => {
    const response = await request(app)
      .post('/auth/google/start')
      .send({
        registration: {
          core_role: 'farmer',
          persona_id: 'partnership_manager',
          phone: '+255712345678',
        },
      })
      .expect(400);

    expect(response.body.error).to.equal('persona_core_role_mismatch');
  });

  it('passes the server-stored registration intent from OAuth state to identity processing', async () => {
    originalMethods.consumeState = GoogleOAuthService.consumeState;
    originalMethods.consumeAuthorizationCode = GoogleOAuthService.consumeAuthorizationCode;
    process.env.APP_BASE_URL = 'https://agrinest.example';
    GoogleOAuthService.consumeState = async () => ({
      persona_id: 'financial_institution',
      phone: '+255712345678',
      invitation_token_hash: null,
    });
    let consumed;
    GoogleOAuthService.consumeAuthorizationCode = async (...args) => {
      consumed = args;
      return 'one-time-exchange-code';
    };

    const response = await request(app)
      .get('/auth/google/callback')
      .set('Cookie', 'agrinest_oauth_state=registration-state')
      .query({ state: 'registration-state', code: 'google-authorization-code' })
      .expect(302);

    expect(response.headers.location).to.equal(
      'https://agrinest.example/?google_code=one-time-exchange-code'
    );
    expect(consumed).to.deep.equal([
      'google-authorization-code',
      {
        persona_id: 'financial_institution',
        phone: '+255712345678',
        invitation_token_hash: null,
      },
    ]);
  });

  it('keeps the existing Google sign-in flow without a registration intent', async () => {
    originalMethods.consumeState = GoogleOAuthService.consumeState;
    originalMethods.consumeAuthorizationCode = GoogleOAuthService.consumeAuthorizationCode;
    process.env.APP_BASE_URL = 'https://agrinest.example';
    GoogleOAuthService.consumeState = async () => ({});
    let consumed;
    GoogleOAuthService.consumeAuthorizationCode = async (...args) => {
      consumed = args;
      return 'one-time-exchange-code';
    };

    await request(app)
      .get('/auth/google/callback')
      .set('Cookie', 'agrinest_oauth_state=signin-state')
      .query({ state: 'signin-state', code: 'google-authorization-code' })
      .expect(302);

    expect(consumed).to.deep.equal(['google-authorization-code', null]);
  });
});
