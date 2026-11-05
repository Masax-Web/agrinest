const request = require('supertest');
const { expect } = require('chai');
const app = require('../../api/generated/server/nodejs-express/app');
const AuthService = require('../../api/services/AuthService');
const FarmService = require('../../api/generated/server/nodejs-express/services/FarmService');
const ListingService = require('../../api/generated/server/nodejs-express/services/ListingService');
const ProcurementService = require('../../api/services/ProcurementService');
const SpaceRentalService = require('../../api/services/SpaceRentalService');

describe('AGRI-NEST API integration', () => {
  const methods = [
    [AuthService, 'getSessionUser'],
    [AuthService, 'loginUser'],
    [AuthService, 'setFarmerPersona'],
    [FarmService, 'createFarm'],
    [FarmService, 'getFarmById'],
    [ListingService, 'createListing'],
    [ListingService, 'listings'],
    [ListingService, 'createOrder'],
    [ListingService, 'recentActivity'],
    [ProcurementService, 'listRfqs'],
    [ProcurementService, 'createRfq'],
    [SpaceRentalService, 'listSpaces'],
    [SpaceRentalService, 'listOwnedSpaces'],
    [SpaceRentalService, 'createSpace'],
    [SpaceRentalService, 'setSpaceStatus'],
    [SpaceRentalService, 'listSpaceRequests'],
    [SpaceRentalService, 'createSpaceRequest'],
    [SpaceRentalService, 'updateSpaceRequest'],
  ];
  const originalMethods = new Map();
  const user = {
    user_id: '00000000-0000-4000-8000-000000000101',
    name: 'API Test Farmer',
    role: 'smallholder_farmer',
    role_status: 'active',
    is_admin: false,
  };
  const farm = { farm_id: 'farm-test-id', user_id: user.user_id, name: 'Test Farm' };
  const listing = { listing_id: 'listing-test-id', farmer_id: user.user_id, crop_type: 'Maize', quantity: 100, price: 20000 };

  beforeEach(() => {
    for (const [index, [service, method]] of methods.entries()) originalMethods.set(String(index), service[method]);
    AuthService.getSessionUser = async (token) => (token === 'api-test-token'
      ? { user, sessionCreatedAt: new Date(), sessionId: 'api-test-session' }
      : null);
    FarmService.createFarm = async (data) => ({ ...farm, name: data.name });
    FarmService.getFarmById = async () => farm;
    ListingService.createListing = async (data) => ({ ...listing, ...data });
    ListingService.listings = async () => [listing];
    ListingService.createOrder = async (data) => ({ order_id: 'order-test-id', items: data.items });
    ListingService.recentActivity = async () => [{
      activity_id: 1,
      event_type: 'order_placed',
      details: { order_id: 'order-test-id' },
    }];
    ProcurementService.listRfqs = async () => [];
    ProcurementService.createRfq = async (data) => ({
      rfq_id: 'rfq-test-id',
      buyer_id: user.user_id,
      feed_type: data.feedType,
      quantity_bags: data.quantityBags,
    });
    SpaceRentalService.listSpaces = async () => [{ space_id: '00000000-0000-4000-8000-000000000201', title: 'North plot', space_type: 'farmland' }];
    SpaceRentalService.listOwnedSpaces = async () => [{ space_id: '00000000-0000-4000-8000-000000000201', owner_id: user.user_id, title: 'North plot' }];
    SpaceRentalService.createSpace = async (data) => ({ space_id: '00000000-0000-4000-8000-000000000201', owner_id: data.ownerId, title: data.title, space_type: data.type, image_url: data.imageUrl });
    SpaceRentalService.setSpaceStatus = async (data) => ({ space_id: data.spaceId, status: data.status });
    SpaceRentalService.listSpaceRequests = async () => [{ request_id: '00000000-0000-4000-8000-000000000202', owner_id: user.user_id, status: 'pending' }];
    SpaceRentalService.createSpaceRequest = async (data) => ({ request_id: '00000000-0000-4000-8000-000000000202', space_id: data.spaceId, requester_id: data.requesterId, status: 'pending' });
    SpaceRentalService.updateSpaceRequest = async (data) => ({ request_id: data.requestId, status: data.status });
  });

  afterEach(() => {
    for (const [index, [service, method]] of methods.entries()) {
      service[method] = originalMethods.get(String(index));
    }
    originalMethods.clear();
  });

  const authenticatedRequest = (method, path) => request(app)[method](path).set('Cookie', 'agrinest_session=api-test-token');

  it('validates required registration fields', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'Test Farmer', phone: '+255700000002', persona_id: 'smallholder_farmer' })
      .expect(400);
  });

  it('returns a documented error when no session is provided', async () => {
    const response = await request(app).get('/auth/me').expect(401);
    expect(response.body.error).to.be.a('string').and.not.empty;
  });

  it('preserves expected login errors through response validation', async () => {
    AuthService.loginUser = async () => {
      throw Object.assign(new Error('invalid_credentials'), { code: 'invalid_credentials', status: 401 });
    };

    const response = await request(app)
      .post('/auth/login')
      .send({ identifier: 'farmer@example.test', password: 'test-password-only' })
      .expect(401);

    expect(response.body.error).to.equal('invalid_credentials');

    AuthService.loginUser = async () => {
      throw Object.assign(new Error('auth_backend_unavailable'), { code: 'auth_backend_unavailable', status: 500 });
    };

    const serverError = await request(app)
      .post('/auth/login')
      .send({ identifier: 'farmer@example.test', password: 'test-password-only' })
      .expect(500);

    expect(serverError.body.error).to.equal('auth_backend_unavailable');
  });

  it('returns the authenticated account', async () => {
    const response = await authenticatedRequest('get', '/auth/me').expect(200);
    expect(response.body.user.user_id).to.equal(user.user_id);
  });

  it('switches persona within the authenticated farmer core role', async () => {
    let updatedUserId;
    let requestedPersonaId;
    AuthService.setFarmerPersona = async ({ userId, personaId }) => {
      updatedUserId = userId;
      requestedPersonaId = personaId;
      return { ...user, role: 'farmer', persona_id: personaId };
    };

    const response = await authenticatedRequest('put', '/auth/persona')
      .send({ persona_id: 'livestock_keeper' })
      .expect(200);

    expect(updatedUserId).to.equal(user.user_id);
    expect(requestedPersonaId).to.equal('livestock_keeper');
    expect(response.body.user).to.include({ role: 'farmer', persona_id: 'livestock_keeper' });
  });

  it('requires authentication to create a farm', async () => {
    await request(app).post('/farms').send({
      user_id: user.user_id,
      name: 'Test Farm',
      location: { latitude: -6.8, longitude: 39.28, accuracy_m: 12, captured_at: new Date().toISOString() },
      location_evidence: { name: 'farm.jpg', mime_type: 'image/jpeg', data_url: 'data:image/jpeg;base64,ZmFrZQ==', captured_at: new Date().toISOString() },
    }).expect(401);
  });

  it('creates and retrieves the authenticated farmer farm', async () => {
    const created = await authenticatedRequest('post', '/farms')
      .send({
        user_id: user.user_id,
        name: 'Test Farm',
        location: { latitude: -6.8, longitude: 39.28, accuracy_m: 12, captured_at: new Date().toISOString() },
        location_evidence: { name: 'farm.jpg', mime_type: 'image/jpeg', data_url: 'data:image/jpeg;base64,ZmFrZQ==', captured_at: new Date().toISOString() },
      })
      .expect(201);
    expect(created.body).to.deep.equal(farm);

    const retrieved = await authenticatedRequest('get', `/farms/${farm.farm_id}`).expect(200);
    expect(retrieved.body).to.deep.equal(farm);
  });

  it('creates fields and marketplace listings through supported routes', async () => {
    const field = { farm_id: farm.farm_id, name: 'North Field', field_boundary: '{}' };
    const fieldResponse = await authenticatedRequest('post', '/fields').send(field).expect(201);
    expect(fieldResponse.body.field).to.deep.equal(field);

    const created = await authenticatedRequest('post', '/soko/listings')
      .send({ crop_type: 'Maize', quantity: 100, price: 20000, image_url: 'data:image/webp;base64,AAAA' })
      .expect(201);
    expect(created.body.listing_id).to.equal(listing.listing_id);
    expect(created.body.image_url).to.equal('data:image/webp;base64,AAAA');

    const listed = await authenticatedRequest('get', '/soko/listings').expect(200);
    expect(listed.body.items).to.deep.equal([listing]);
  });

  it('creates orders and publishes their activity', async () => {
    const order = await authenticatedRequest('post', '/soko/orders')
      .send({
        buyer_name: user.name,
        items: [{ product_id: listing.listing_id, name: 'Maize', quantity: 2, unit_price: 20000 }],
        total_amount: 40000,
      })
      .expect(201);
    expect(order.body.order_id).to.equal('order-test-id');

    const activity = await authenticatedRequest('get', '/soko/activity?limit=30').expect(200);
    expect(activity.body.items[0].details.order_id).to.equal(order.body.order_id);
  });

  it('creates a feed request through the procurement API', async () => {
    const response = await authenticatedRequest('post', '/soko/rfqs')
      .send({
        feed_type: 'Layer Mash',
        quantity_bags: 25,
        required_delivery_date: '2026-12-01',
        specifications: '',
      })
      .expect(201);
    expect(response.body).to.include({ rfq_id: 'rfq-test-id', feed_type: 'Layer Mash', quantity_bags: 25 });
  });

  it('publishes rental spaces and handles non-binding rental inquiries', async () => {
    const listed = await request(app).get('/soko/spaces').expect(200);
    expect(listed.body.items[0]).to.include({ space_id: '00000000-0000-4000-8000-000000000201', space_type: 'farmland' });

    await request(app).get('/soko/spaces/mine').expect(401);
    const mine = await authenticatedRequest('get', '/soko/spaces/mine').expect(200);
    expect(mine.body.items[0].owner_id).to.equal(user.user_id);
    const created = await authenticatedRequest('post', '/soko/spaces')
      .send({
        title: 'North plot',
        space_type: 'farmland',
        region: 'Iringa',
        quantity: 2,
        unit: 'acres',
        price: 120000,
        price_period: 'season',
        image_url: 'data:image/webp;base64,AAAA',
      })
      .expect(201);
    expect(created.body).to.include({ owner_id: user.user_id, title: 'North plot', image_url: 'data:image/webp;base64,AAAA' });
    const paused = await authenticatedRequest('patch', '/soko/spaces/00000000-0000-4000-8000-000000000201/status')
      .send({ status: 'inactive' })
      .expect(200);
    expect(paused.body.status).to.equal('inactive');

    const inquiry = await authenticatedRequest('post', '/soko/spaces/00000000-0000-4000-8000-000000000201/requests')
      .send({ requested_from: '2027-01-01', message: 'Is irrigation available?' })
      .expect(201);
    expect(inquiry.body).to.include({ space_id: '00000000-0000-4000-8000-000000000201', requester_id: user.user_id, status: 'pending' });

    const requests = await authenticatedRequest('get', '/soko/space-requests').expect(200);
    expect(requests.body.items[0].status).to.equal('pending');
    const updated = await authenticatedRequest('patch', '/soko/space-requests/00000000-0000-4000-8000-000000000202')
      .send({ status: 'accepted' })
      .expect(200);
    expect(updated.body.status).to.equal('accepted');
  });

  it('blocks non-admin accounts from the admin-only user directory', async () => {
    await authenticatedRequest('get', '/users').expect(403);
  });
});
