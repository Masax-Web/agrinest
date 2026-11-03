const request = require('supertest');
const { expect } = require('chai');
const app = require('../../api/generated/server/nodejs-express/app');
const AuthService = require('../../api/services/AuthService');
const FarmService = require('../../api/generated/server/nodejs-express/services/FarmService');
const ListingService = require('../../api/generated/server/nodejs-express/services/ListingService');
const ProcurementService = require('../../api/services/ProcurementService');

describe('AGRI-NEST API integration', () => {
  const methods = [
    [AuthService, 'getSessionUser'],
    [FarmService, 'createFarm'],
    [FarmService, 'getFarmById'],
    [ListingService, 'createListing'],
    [ListingService, 'listings'],
    [ListingService, 'createOrder'],
    [ListingService, 'recentActivity'],
    [ProcurementService, 'listRfqs'],
    [ProcurementService, 'createRfq'],
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

  it('returns the authenticated account', async () => {
    const response = await authenticatedRequest('get', '/auth/me').expect(200);
    expect(response.body.user.user_id).to.equal(user.user_id);
  });

  it('requires authentication to create a farm', async () => {
    await request(app).post('/farms').send({ name: 'Test Farm' }).expect(401);
  });

  it('creates and retrieves the authenticated farmer farm', async () => {
    const created = await authenticatedRequest('post', '/farms')
      .send({ user_id: user.user_id, name: 'Test Farm' })
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
      .send({ crop_type: 'Maize', quantity: 100, price: 20000 })
      .expect(201);
    expect(created.body.listing_id).to.equal(listing.listing_id);

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

  it('blocks non-admin accounts from the admin-only user directory', async () => {
    await authenticatedRequest('get', '/users').expect(403);
  });
});
