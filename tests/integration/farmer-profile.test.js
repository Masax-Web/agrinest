const request = require('supertest');
const { expect } = require('chai');
const AuthService = require('../../api/services/AuthService');
const app = require('../../api/generated/server/nodejs-express/app');

describe('Authenticated farmer profile API', () => {
  const originalMethods = {};
  const userId = '00000000-0000-4000-8000-000000000011';

  beforeEach(() => {
    originalMethods.getSessionUser = AuthService.getSessionUser;
    originalMethods.getFarmerProfile = AuthService.getFarmerProfile;
    originalMethods.saveFarmerProfile = AuthService.saveFarmerProfile;
    AuthService.getSessionUser = async (token) => (token === 'profile-test-token'
      ? { user: { user_id: userId }, sessionCreatedAt: new Date(), sessionId: 'profile-session' }
      : null);
  });

  afterEach(() => {
    Object.assign(AuthService, originalMethods);
  });

  it('returns the profile for the authenticated account', async () => {
    AuthService.getFarmerProfile = async (requestedUserId) => {
      expect(requestedUserId).to.equal(userId);
      return { profile: { name: 'Neema' }, has_saved_profile: false, updated_at: null };
    };

    const response = await request(app)
      .get('/auth/profile')
      .set('Cookie', 'agrinest_session=profile-test-token')
      .expect(200);

    expect(response.body).to.deep.equal({
      profile: { name: 'Neema' },
      has_saved_profile: false,
      updated_at: null,
    });
  });

  it('saves the profile only for the authenticated account', async () => {
    const profile = { name: 'Neema', avatar: 'https://example.test/neema.jpg' };
    AuthService.saveFarmerProfile = async (requestedUserId, savedProfile) => {
      expect(requestedUserId).to.equal(userId);
      expect(savedProfile).to.deep.equal(profile);
      return { profile, has_saved_profile: true, updated_at: '2026-10-05T12:00:00.000Z' };
    };

    const response = await request(app)
      .put('/auth/profile')
      .set('Cookie', 'agrinest_session=profile-test-token')
      .send({ profile })
      .expect(200);

    expect(response.body.has_saved_profile).to.equal(true);
    expect(response.body.profile).to.deep.equal(profile);
  });

  it('accepts and returns Digital Farm records in the authenticated profile', async () => {
    const farmRecords = {
      fields: [{ id: 'field-1', name: 'North plot' }],
      listings: [],
      income: [],
      expenses: [],
      crowdfunding: [{ id: 'campaign-1', title: 'Community grain store', goal: 1200000, pledges: [] }],
      livestock: [],
      groups: [],
      activities: [],
      requests: [],
    };
    const profile = { name: 'Neema', farmRecords };
    AuthService.saveFarmerProfile = async (requestedUserId, savedProfile) => {
      expect(requestedUserId).to.equal(userId);
      expect(savedProfile).to.deep.equal(profile);
      return { profile, has_saved_profile: true, updated_at: '2026-11-03T08:00:00.000Z' };
    };

    const response = await request(app)
      .put('/auth/profile')
      .set('Cookie', 'agrinest_session=profile-test-token')
      .send({ profile })
      .expect(200);

    expect(response.body.profile.farmRecords).to.deep.equal(farmRecords);
  });

  it('requires an authenticated session', async () => {
    await request(app).get('/auth/profile').expect(401);
  });
});
