const request = require('supertest');
const { expect } = require('chai');
const app = require('../../api/generated/server/nodejs-express/app');

describe('Google OAuth callback', () => {
  it('accepts Google callback query parameters and validates the state in the handler', async () => {
    const previousBaseUrl = process.env.APP_BASE_URL;
    process.env.APP_BASE_URL = 'https://agrinest.example';

    try {
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
    } finally {
      if (previousBaseUrl === undefined) delete process.env.APP_BASE_URL;
      else process.env.APP_BASE_URL = previousBaseUrl;
    }
  });
});
