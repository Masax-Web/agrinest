const request = require('supertest');
const { expect } = require('chai');

const api = request(process.env.API_URL || 'http://localhost:3000');

describe('AGRI-NEST API integration', function() {
  this.timeout(20000);
  let userId;
  let farmId;
  let listingId;

  it('registers a user', async () => {
    const res = await api.post('/auth/register').send({ phone: '+255700000002', name: 'Test Farmer' }).expect(201);
    expect(res.body).to.have.property('user_id');
    expect(res.body).to.include({ phone: '+255700000002', name: 'Test Farmer' });
    userId = res.body.user_id;
  });

  it('creates a farm for the user', async () => {
    const res = await api.post('/farms').send({ user_id: userId, name: 'Test Farm' }).expect(201);
    expect(res.body).to.have.property('farm_id');
    expect(res.body).to.include({ user_id: userId, name: 'Test Farm' });
    farmId = res.body.farm_id;
  });

  it('retrieves the created farm', async () => {
    const res = await api.get(`/farms/${farmId}`).expect(200);
    expect(res.body).to.include({ farm_id: farmId, user_id: userId, name: 'Test Farm' });
  });

  it('creates a marketplace listing', async () => {
    const listing = { farmer_id: userId, crop_type: 'Maize', quantity: 100, price: 20000 };
    const res = await api.post('/soko/listings').send(listing).expect(201);
    expect(res.body).to.include({ farmer_id: userId, crop_type: 'Maize' });
    expect(res.body).to.have.property('listing_id');
    listingId = res.body.listing_id;
  });

  it('lists marketplace items', async () => {
    const res = await api.get('/soko/listings').expect(200);
    expect(res.body).to.have.property('items').that.is.an('array');
    expect(res.body.items.some(item => item.listing_id === listingId)).to.be.true;
  });

  it('returns Jicho scan results', async () => {
    const res = await api.post('/jicho/scan').send({ farmer_id: userId, image_base64: 'AAA' }).expect(200);
    expect(res.body).to.have.property('diagnosis');
    expect(res.body).to.have.property('confidence');
  });

  it('supports user CRUD endpoints', async () => {
    const createRes = await api.post('/users').send({ phone: '+255700000003', name: 'CRUD User', role: 'farmer' }).expect(201);
    const id = createRes.body.user_id || createRes.body.id;
    expect(id).to.exist;

    const listRes = await api.get('/users').expect(200);
    expect(listRes.body.items || listRes.body).to.be.an('array');

    const updateRes = await api.put(`/users/${id}`).send({ name: 'Updated CRUD User', role: 'buyer' }).expect(200);
    expect(updateRes.body.name).to.equal('Updated CRUD User');

    const deleteRes = await api.delete(`/users/${id}`).expect(200);
    expect(deleteRes.body.success).to.equal(true);
  });

  it('supports field CRUD endpoints', async () => {
    const createRes = await api.post('/fields').send({ farm_id: farmId, name: 'North Field', crop: 'Maize' }).expect(201);
    const id = createRes.body.field_id || createRes.body.id;
    expect(id).to.exist;

    const listRes = await api.get('/fields').expect(200);
    expect(listRes.body.items || listRes.body).to.be.an('array');

    const updateRes = await api.put(`/fields/${id}`).send({ name: 'North Field Updated', crop: 'Beans' }).expect(200);
    expect(updateRes.body.name).to.equal('North Field Updated');

    const deleteRes = await api.delete(`/fields/${id}`).expect(200);
    expect(deleteRes.body.success).to.equal(true);
  });

  it('supports finance, order, livestock, and admin CRUD endpoints', async () => {
    const financeCreate = await api.post('/finance/loans').send({ applicant_id: userId, amount: 2500000, product: 'agri-loan' }).expect(201);
    const financeId = financeCreate.body.id || financeCreate.body.loan_id;
    expect(financeId).to.exist;
    await api.get('/finance/loans').expect(200);
    await api.put(`/finance/loans/${financeId}`).send({ status: 'approved' }).expect(200);
    await api.delete(`/finance/loans/${financeId}`).expect(200);

    const orderCreate = await api.post('/orders').send({ buyer_id: userId, item: 'Maize', quantity: 50, total_amount: 500000 }).expect(201);
    const orderId = orderCreate.body.id || orderCreate.body.order_id;
    expect(orderId).to.exist;
    await api.get('/orders').expect(200);
    await api.put(`/orders/${orderId}`).send({ status: 'packed' }).expect(200);
    await api.delete(`/orders/${orderId}`).expect(200);

    const livestockCreate = await api.post('/livestock/herds').send({ owner_id: userId, name: 'Kilimanjaro Herd', animal_type: 'cow', count: 18 }).expect(201);
    const herdId = livestockCreate.body.id || livestockCreate.body.herd_id;
    expect(herdId).to.exist;
    await api.get('/livestock/herds').expect(200);
    await api.put(`/livestock/herds/${herdId}`).send({ count: 20 }).expect(200);
    await api.delete(`/livestock/herds/${herdId}`).expect(200);

    const adminCreate = await api.post('/admin/workflows').send({ title: 'Review farmer onboarding', assignee: 'admin' }).expect(201);
    const workflowId = adminCreate.body.id || adminCreate.body.workflow_id;
    expect(workflowId).to.exist;
    await api.get('/admin/workflows').expect(200);
    await api.put(`/admin/workflows/${workflowId}`).send({ status: 'in-progress' }).expect(200);
    await api.delete(`/admin/workflows/${workflowId}`).expect(200);
  });
});
