const request = require('supertest');
const { expect } = require('chai');
const AuthService = require('../../api/services/AuthService');
const app = require('../../api/generated/server/nodejs-express/app');

describe('Super-admin impersonation', () => {
  const originalMethods = {};
  const adminUser = {
    user_id: '00000000-0000-4000-8000-000000000001',
    name: 'Platform Admin',
    email: 'admin@example.test',
    role: 'super_admin',
    role_status: 'active',
    is_admin: true,
  };
  const farmerUser = {
    user_id: '00000000-0000-4000-8000-000000000002',
    name: 'Farm Test Account',
    email: 'farmer@example.test',
    role: 'smallholder_farmer',
    role_status: 'active',
    is_admin: false,
  };
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  let startCalled;
  let endCalled;

  beforeEach(() => {
    for (const method of ['getSessionUser', 'getAdminImpersonation', 'startAdminImpersonation', 'endAdminImpersonation']) {
      originalMethods[method] = AuthService[method];
    }
    startCalled = false;
    endCalled = false;
    AuthService.getSessionUser = async (token) => (token === 'admin-test-token'
      ? { user: adminUser, sessionCreatedAt: new Date(), sessionId: '00000000-0000-4000-8000-000000000003' }
      : null);
    AuthService.getAdminImpersonation = async (token) => (token === 'impersonation-test-token'
      ? { user: farmerUser, actor: adminUser, sessionId: '00000000-0000-4000-8000-000000000004', expiresAt: expiry }
      : null);
    AuthService.startAdminImpersonation = async ({ actorId, actorSessionId, targetId }) => {
      startCalled = true;
      expect(actorId).to.equal(adminUser.user_id);
      expect(actorSessionId).to.equal('00000000-0000-4000-8000-000000000003');
      expect(targetId).to.equal(farmerUser.user_id);
      return { token: 'impersonation-test-token', user: farmerUser, admin: adminUser, expiresAt: expiry };
    };
    AuthService.endAdminImpersonation = async ({ token, actorId }) => {
      endCalled = true;
      expect(token).to.equal('impersonation-test-token');
      expect(actorId).to.equal(adminUser.user_id);
      return true;
    };
  });

  afterEach(() => {
    for (const [method, implementation] of Object.entries(originalMethods)) {
      AuthService[method] = implementation;
    }
  });

  it('starts a target session, blocks admin access, and returns to the preserved admin session', async () => {
    const start = await request(app)
      .post('/auth/admin/impersonate')
      .set('Cookie', 'agrinest_session=admin-test-token')
      .send({ user_id: farmerUser.user_id })
      .expect(200);

    expect(startCalled).to.equal(true);
    expect(start.body.user.role).to.equal('smallholder_farmer');
    expect(start.body.impersonation.admin.is_admin).to.equal(true);
    expect(start.headers['set-cookie'].join(';')).to.include('agrinest_impersonation=impersonation-test-token');

    const currentUser = await request(app)
      .get('/auth/me')
      .set('Cookie', 'agrinest_session=admin-test-token; agrinest_impersonation=impersonation-test-token')
      .expect(200);
    expect(currentUser.body.user.user_id).to.equal(farmerUser.user_id);
    expect(currentUser.body.impersonation.admin.user_id).to.equal(adminUser.user_id);

    await request(app)
      .get('/auth/admin/users')
      .set('Cookie', 'agrinest_session=admin-test-token; agrinest_impersonation=impersonation-test-token')
      .expect(403);

    const end = await request(app)
      .post('/auth/admin/impersonate/end')
      .set('Cookie', 'agrinest_session=admin-test-token; agrinest_impersonation=impersonation-test-token')
      .expect(200);
    expect(endCalled).to.equal(true);
    expect(end.body.user.user_id).to.equal(adminUser.user_id);
    expect(end.headers['set-cookie'].join(';')).to.include('agrinest_impersonation=;');
  });

  it('does not allow a non-admin account to start impersonation', async () => {
    AuthService.getSessionUser = async () => ({ user: farmerUser, sessionCreatedAt: new Date(), sessionId: 'farmer-session' });
    await request(app)
      .post('/auth/admin/impersonate')
      .set('Cookie', 'agrinest_session=farmer-test-token')
      .send({ user_id: adminUser.user_id })
      .expect(403);
    expect(startCalled).to.equal(false);
  });

  it('requires an administrator session to start or end impersonation', async () => {
    await request(app)
      .post('/auth/admin/impersonate')
      .send({ user_id: farmerUser.user_id })
      .expect(401);
    await request(app)
      .post('/auth/admin/impersonate/end')
      .expect(401);
  });
});
