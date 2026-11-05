const request = require('supertest');
const { expect } = require('chai');
const app = require('../../api/generated/server/nodejs-express/app');
const AuthService = require('../../api/services/AuthService');
const FarmOperations = require('../../api/services/FarmOperations');
const { ensureCrossRoleWorkflowSchema } = require('../../api/services/CrossRoleWorkflows');

describe('shared farm operations API', () => {
  const methods = [
    'listFarms',
    'listOperations',
    'inviteFarmMember',
    'respondToFarmInvitation',
    'createFarmTask',
    'updateFarmTask',
    'createResourceRequest',
    'reviewResourceRequest',
    'createFarmBudget',
    'addFarmBudgetEntry',
    'listFarmActivityLogs',
    'createFarmActivityLog',
    'getFarmActivityEvidence',
  ];
  const originals = new Map();
  const user = {
    user_id: '00000000-0000-4000-8000-000000000101',
    name: 'Farm Operations Test',
    role: 'farmer',
    role_status: 'active',
    is_admin: false,
  };
  const farmId = '00000000-0000-4000-8000-000000000201';
  const taskId = '00000000-0000-4000-8000-000000000301';
  const requestId = '00000000-0000-4000-8000-000000000401';
  const membershipId = '00000000-0000-4000-8000-000000000501';
  const budgetId = '00000000-0000-4000-8000-000000000601';
  const entryId = '00000000-0000-4000-8000-000000000701';
  const activityId = '00000000-0000-4000-8000-000000000801';
  let originalGetSessionUser;

  const authenticatedRequest = (method, path) => request(app)[method](path).set('Cookie', 'agrinest_session=operations-test-token');

  beforeEach(() => {
    originalGetSessionUser = AuthService.getSessionUser;
    AuthService.getSessionUser = async (token) => (token === 'operations-test-token'
      ? { user, sessionCreatedAt: new Date(), sessionId: 'operations-test-session' }
      : null);
    for (const method of methods) {
      originals.set(method, FarmOperations[method]);
    }
    FarmOperations.listFarms = async () => [{ farm_id: farmId, name: 'Test farm', role: 'owner', status: 'active' }];
    FarmOperations.listOperations = async ({ userId }) => ({
      role: userId === user.user_id ? 'owner' : 'worker',
      members: [],
      tasks: [],
      resource_requests: [],
      audit: [],
      budgets: [],
    });
    FarmOperations.inviteFarmMember = async (data) => ({ membership_id: membershipId, ...data, status: 'pending' });
    FarmOperations.respondToFarmInvitation = async (data) => data;
    FarmOperations.createFarmTask = async (data) => ({ task_id: taskId, farm_id: data.farmId, status: 'open', title: data.title });
    FarmOperations.updateFarmTask = async (data) => ({ task_id: data.taskId, status: data.status });
    FarmOperations.createResourceRequest = async (data) => ({ request_id: requestId, farm_id: data.farmId, status: 'pending', title: data.title });
    FarmOperations.reviewResourceRequest = async (data) => ({ request_id: data.requestId, status: data.status });
    FarmOperations.createFarmBudget = async (data) => ({
      budget_id: budgetId,
      farm_id: data.farmId,
      title: data.title,
      crop: data.crop,
      planned_costs: data.plannedCosts,
      entries: [],
    });
    FarmOperations.addFarmBudgetEntry = async (data) => ({
      entry_id: entryId,
      budget_id: data.budgetId,
      type: data.type,
      category: data.category,
      amount: data.amount,
      entry_date: data.entryDate,
    });
    FarmOperations.listFarmActivityLogs = async () => [{
      activity_id: activityId,
      farm_id: farmId,
      activity_type: 'Spraying (Pest Control)',
      crop: 'Maize',
      content_hash: 'a'.repeat(64),
      has_evidence: false,
    }];
    FarmOperations.createFarmActivityLog = async (data) => ({
      activity_id: activityId,
      farm_id: data.farmId,
      activity_type: data.activityType,
      activity_date: data.activityDate,
      crop: data.crop,
      content_hash: 'a'.repeat(64),
      previous_hash: null,
      has_evidence: Boolean(data.evidence),
    });
    FarmOperations.getFarmActivityEvidence = async () => ({
      photo_name: 'field.jpg',
      photo_mime_type: 'image/jpeg',
      photo_data: 'data:image/jpeg;base64,ZmFrZQ==',
      photo_sha256: 'b'.repeat(64),
    });
  });

  afterEach(() => {
    AuthService.getSessionUser = originalGetSessionUser;
    for (const method of methods) FarmOperations[method] = originals.get(method);
    originals.clear();
  });

  it('requires an authenticated account to list farms', async () => {
    await request(app).get('/farms').expect(401);
  });

  it('protects farm activity logs and validates finalized activity fields', async () => {
    await request(app).get(`/farms/${farmId}/activity-logs`).expect(401);

    await authenticatedRequest('post', `/farms/${farmId}/activity-logs`)
      .send({
        activity_date: '2026-11-05',
        crop: 'Maize',
        activity_type: 'Unrecognized activity',
        details: {},
      })
      .expect(400);
  });

  it('creates the base farms table before dependent workflow tables', async () => {
    const statements = [];
    await ensureCrossRoleWorkflowSchema({ raw: async (statement) => statements.push(statement) });
    const farmsTableIndex = statements.findIndex((statement) => statement.includes('CREATE TABLE IF NOT EXISTS farms ('));
    const membersTableIndex = statements.findIndex((statement) => statement.includes('CREATE TABLE IF NOT EXISTS farm_members ('));
    const activityTableIndex = statements.findIndex((statement) => statement.includes('CREATE TABLE IF NOT EXISTS farm_activity_logs ('));
    expect(farmsTableIndex).to.equal(0);
    expect(membersTableIndex).to.be.greaterThan(farmsTableIndex);
    expect(activityTableIndex).to.be.greaterThan(farmsTableIndex);
    expect(statements[farmsTableIndex]).to.include('REFERENCES users(user_id)');
    expect(statements[activityTableIndex]).to.include('REFERENCES farms(farm_id) ON DELETE RESTRICT');
    expect(statements.find((statement) => statement.includes('CREATE TRIGGER farm_activity_logs_append_only'))).to.be.a('string');
  });

  it('lists owned farms and invites team members with a pending status', async () => {
    const listed = await authenticatedRequest('get', '/farms').expect(200);
    expect(listed.body.farms[0]).to.include({ farm_id: farmId, role: 'owner' });

    const invited = await authenticatedRequest('post', `/farms/${farmId}/members`)
      .send({ email: 'worker@example.test', role: 'worker' })
      .expect(201);
    expect(invited.body.member).to.include({ membership_id: membershipId, role: 'worker', status: 'pending' });
  });

  it('creates a farm task and a resource request using documented fields', async () => {
    const task = await authenticatedRequest('post', `/farms/${farmId}/tasks`)
      .send({ title: 'Inspect irrigation lines', assigned_to: user.user_id, due_date: '2026-11-20' })
      .expect(201);
    expect(task.body.task).to.include({ task_id: taskId, farm_id: farmId, status: 'open' });

    const resourceRequest = await authenticatedRequest('post', `/farms/${farmId}/resource-requests`)
      .send({ title: 'DAP fertilizer', quantity: 10, estimated_cost: 680000 })
      .expect(201);
    expect(resourceRequest.body.request).to.include({ request_id: requestId, status: 'pending' });
  });

  it('updates task and resource request state through the farm routes', async () => {
    const task = await authenticatedRequest('patch', `/farms/${farmId}/tasks/${taskId}`)
      .send({ status: 'completed' })
      .expect(200);
    expect(task.body.task).to.include({ task_id: taskId, status: 'completed' });

    const approval = await authenticatedRequest('patch', `/farms/${farmId}/resource-requests/${requestId}`)
      .send({ status: 'approved' })
      .expect(200);
    expect(approval.body.request).to.include({ request_id: requestId, status: 'approved' });
  });

  it('creates a shared season budget and records actual finance entries', async () => {
    const budget = await authenticatedRequest('post', `/farms/${farmId}/budgets`)
      .send({
        title: '2026 sunflower season',
        crop: 'Sunflower',
        planned_costs: [{ category: 'Seeds', amount: 125000 }],
        expected_yield_kg: 900,
        target_price_per_kg: 1800,
      })
      .expect(201);
    expect(budget.body.budget).to.include({
      budget_id: budgetId,
      farm_id: farmId,
      title: '2026 sunflower season',
      crop: 'Sunflower',
    });

    const entry = await authenticatedRequest('post', `/farms/${farmId}/budgets/${budgetId}/entries`)
      .send({
        type: 'expense',
        category: 'Seeds',
        amount: 120000,
        entry_date: '2026-10-01',
        note: 'Purchased certified seed',
      })
      .expect(201);
    expect(entry.body.entry).to.include({
      entry_id: entryId,
      budget_id: budgetId,
      type: 'expense',
      amount: 120000,
    });
  });

  it('lists, finalizes, and retrieves append-only farm activity evidence', async () => {
    const listed = await authenticatedRequest('get', `/farms/${farmId}/activity-logs`).expect(200);
    expect(listed.body.logs[0]).to.include({
      activity_id: activityId,
      activity_type: 'Spraying (Pest Control)',
    });

    const finalized = await authenticatedRequest('post', `/farms/${farmId}/activity-logs`)
      .send({
        activity_date: '2026-11-05',
        crop: 'Maize',
        activity_type: 'Spraying (Pest Control)',
        field_name: 'North field',
        details: { product_name: 'Example product', dosage_rate: '2 L/ha', water_volume_liters: 200 },
        location: { latitude: -7.77, longitude: 35.69, accuracy_m: 12, captured_at: '2026-11-05T10:00:00.000Z' },
        weather: { temperature_c: 24, humidity_percent: 62, wind_kmh: 8, source: 'Open-Meteo', observed_at: '2026-11-05T10:00:00.000Z' },
        evidence: { name: 'field.jpg', mime_type: 'image/jpeg', data_url: 'data:image/jpeg;base64,ZmFrZQ==' },
      })
      .expect(201);
    expect(finalized.body.log).to.include({
      activity_id: activityId,
      farm_id: farmId,
      activity_type: 'Spraying (Pest Control)',
      has_evidence: true,
    });

    const evidence = await authenticatedRequest('get', `/farms/${farmId}/activity-logs/${activityId}/evidence`).expect(200);
    expect(evidence.body.evidence).to.include({ name: 'field.jpg', mime_type: 'image/jpeg' });
  });
});
