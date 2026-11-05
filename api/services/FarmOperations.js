const knex = require('../db');
const crypto = require('crypto');

const farmActivityTypes = new Set([
  'Planting',
  'Spraying (Pest Control)',
  'Irrigation',
  'Harvest',
  'Fertilizing',
  'Other',
]);

function operationError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw operationError(`invalid_${field}`);
  }
  return value.trim();
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > maxLength) throw operationError(`invalid_${field}`);
  return value.trim();
}

function optionalAmount(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
    throw operationError(`invalid_${field}`);
  }
  return amount;
}

function optionalDate(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw operationError(`invalid_${field}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw operationError(`invalid_${field}`);
  }
  return value;
}

async function getMembership(database, farmId, userId) {
  const query = database('farms')
    .leftJoin('farm_members', function joinMembers() {
      this.on('farm_members.farm_id', '=', 'farms.farm_id')
        .andOn('farm_members.user_id', '=', database.raw('?', [userId]));
    })
    .where('farms.farm_id', farmId)
    .select(
      'farms.farm_id',
      'farms.user_id as owner_id',
      'farm_members.membership_id',
      'farm_members.role as member_role',
      'farm_members.status as member_status',
    );
  const row = await query.first();
  if (!row) throw operationError('farm_not_found', 404);
  if (row.owner_id === userId) return { role: 'owner', status: 'active', ownerId: row.owner_id };
  if (!row.membership_id) throw operationError('farm_access_denied', 403);
  return { role: row.member_role, status: row.member_status, ownerId: row.owner_id, membershipId: row.membership_id };
}

async function assertActiveFarmMember(database, farmId, userId) {
  const membership = await getMembership(database, farmId, userId);
  if (membership.status !== 'active') throw operationError('farm_membership_not_active', 403);
  return membership;
}

async function recordAudit(transaction, { farmId, actorId, action, targetType, targetId = null, metadata = {} }) {
  await transaction('farm_operation_audit').insert({
    farm_id: farmId,
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata,
  });
}

async function listFarms(userId) {
  return knex('farms')
    .leftJoin('farm_members', function joinMembers() {
      this.on('farm_members.farm_id', '=', 'farms.farm_id')
        .andOn('farm_members.user_id', '=', knex.raw('?', [userId]));
    })
    .where('farms.user_id', userId)
    .orWhere('farm_members.user_id', userId)
    .select(
      'farms.farm_id',
      'farms.user_id as owner_id',
      'farms.name',
      'farms.soil_type',
      'farms.total_acres',
      'farms.location_latitude',
      'farms.location_longitude',
      'farms.location_accuracy_m',
      'farms.location_captured_at',
      'farms.location_review_status',
      knex.raw('(farms.location_evidence IS NOT NULL) AS has_location_evidence'),
      'farms.created_at',
      'farm_members.membership_id',
      'farm_members.role as member_role',
      'farm_members.status as member_status',
    )
    .orderBy('farms.created_at', 'desc')
    .limit(100)
    .then((rows) => rows.map((row) => ({
      ...row,
      role: row.owner_id === userId ? 'owner' : row.member_role,
      status: row.owner_id === userId ? 'active' : row.member_status,
      total_acres: row.total_acres === null ? null : Number(row.total_acres),
    })));
}

async function listOperations({ farmId, userId }) {
  const membership = await assertActiveFarmMember(knex, farmId, userId);
  const [members, tasks, requests, audit, budgets] = await Promise.all([
    knex('farms')
      .join('users as owners', 'owners.user_id', 'farms.user_id')
      .where('farms.farm_id', farmId)
      .select(
        'farms.user_id as user_id',
        'owners.name as name',
        knex.raw("'owner'::text as role"),
        knex.raw("'active'::text as status"),
        knex.raw('farms.created_at as joined_at'),
      )
      .unionAll(
        knex('farm_members')
          .join('users as members', 'members.user_id', 'farm_members.user_id')
          .where('farm_members.farm_id', farmId)
          .select(
            'farm_members.user_id',
            'members.name',
            'farm_members.role',
            'farm_members.status',
            'farm_members.created_at as joined_at',
          ),
      ),
    knex('farm_tasks as tasks')
      .leftJoin('users as assignees', 'assignees.user_id', 'tasks.assigned_to')
      .join('users as creators', 'creators.user_id', 'tasks.created_by')
      .where('tasks.farm_id', farmId)
      .select('tasks.*', 'assignees.name as assignee_name', 'creators.name as created_by_name')
      .orderByRaw("CASE WHEN tasks.status IN ('completed', 'cancelled') THEN 1 ELSE 0 END")
      .orderBy('tasks.due_date', 'asc')
      .limit(200),
    knex('farm_resource_requests as requests')
      .join('users as requesters', 'requesters.user_id', 'requests.requested_by')
      .leftJoin('users as reviewers', 'reviewers.user_id', 'requests.reviewed_by')
      .where('requests.farm_id', farmId)
      .select('requests.*', 'requesters.name as requester_name', 'reviewers.name as reviewer_name')
      .orderByRaw("CASE WHEN requests.status = 'pending' THEN 0 ELSE 1 END")
      .orderBy('requests.created_at', 'desc')
      .limit(200),
    knex('farm_operation_audit as audit')
      .join('users', 'users.user_id', 'audit.actor_id')
      .where('audit.farm_id', farmId)
      .select('audit.audit_id', 'audit.action', 'audit.target_type', 'audit.target_id', 'audit.metadata', 'audit.created_at', 'users.name as actor_name')
      .orderBy('audit.created_at', 'desc')
      .limit(50),
    ['owner', 'manager'].includes(membership.role)
      ? knex('farm_season_budgets as budgets')
        .join('users as creators', 'creators.user_id', 'budgets.created_by')
        .where('budgets.farm_id', farmId)
        .select('budgets.*', 'creators.name as created_by_name')
        .orderBy('budgets.created_at', 'desc')
        .limit(100)
      : Promise.resolve([]),
  ]);
  const budgetIds = budgets.map((budget) => budget.budget_id);
  const budgetEntries = budgetIds.length
    ? await knex('farm_budget_entries as entries')
      .join('users', 'users.user_id', 'entries.created_by')
      .whereIn('entries.budget_id', budgetIds)
      .select('entries.*', 'users.name as created_by_name')
      .orderBy('entries.entry_date', 'desc')
      .limit(1000)
    : [];
  const entriesByBudget = new Map();
  budgetEntries.forEach((entry) => {
    const current = entriesByBudget.get(entry.budget_id) || [];
    current.push({ ...entry, amount: Number(entry.amount) });
    entriesByBudget.set(entry.budget_id, current);
  });
  return {
    role: membership.role,
    members,
    tasks,
    resource_requests: requests.map((request) => ({
      ...request,
      quantity: request.quantity === null ? null : Number(request.quantity),
      estimated_cost: request.estimated_cost === null ? null : Number(request.estimated_cost),
    })),
    audit,
    budgets: budgets.map((budget) => ({
      ...budget,
      area_acres: budget.area_acres === null ? null : Number(budget.area_acres),
      expected_yield_kg: budget.expected_yield_kg === null ? null : Number(budget.expected_yield_kg),
      target_price_per_kg: budget.target_price_per_kg === null ? null : Number(budget.target_price_per_kg),
      entries: entriesByBudget.get(budget.budget_id) || [],
    })),
  };
}

async function createFarmBudget({ farmId, actorId, title, crop, fieldId, areaAcres, expectedYieldKg, targetPricePerKg, plannedCosts, startDate, endDate }) {
  const normalizedTitle = requiredText(title, 'title', 120);
  const normalizedCrop = requiredText(crop, 'crop', 80);
  const normalizedFieldId = optionalText(fieldId, 'field_id', 120);
  const normalizedArea = optionalAmount(areaAcres, 'area_acres');
  const normalizedYield = optionalAmount(expectedYieldKg, 'expected_yield_kg');
  const normalizedTargetPrice = optionalAmount(targetPricePerKg, 'target_price_per_kg');
  const normalizedStart = optionalDate(startDate, 'start_date');
  const normalizedEnd = optionalDate(endDate, 'end_date');
  if (normalizedStart && normalizedEnd && normalizedEnd < normalizedStart) throw operationError('invalid_season_dates');
  if (!Array.isArray(plannedCosts) || plannedCosts.length > 20) throw operationError('invalid_planned_costs');
  const normalizedCosts = plannedCosts.map((item) => ({
    category: requiredText(item?.category, 'cost_category', 60),
    amount: optionalAmount(item?.amount, 'cost_amount'),
  }));
  if (normalizedCosts.some((item) => item.amount === null)) throw operationError('invalid_cost_amount');

  return knex.transaction(async (transaction) => {
    const membership = await assertActiveFarmMember(transaction, farmId, actorId);
    if (!['owner', 'manager'].includes(membership.role)) throw operationError('farm_budget_not_authorized', 403);
    const [budget] = await transaction('farm_season_budgets').insert({
      farm_id: farmId,
      title: normalizedTitle,
      crop: normalizedCrop,
      field_id: normalizedFieldId,
      area_acres: normalizedArea,
      expected_yield_kg: normalizedYield,
      target_price_per_kg: normalizedTargetPrice,
      planned_costs: JSON.stringify(normalizedCosts),
      start_date: normalizedStart,
      end_date: normalizedEnd,
      created_by: actorId,
    }).returning('*');
    await recordAudit(transaction, { farmId, actorId, action: 'season_budget_created', targetType: 'budget', targetId: budget.budget_id });
    return {
      ...budget,
      area_acres: budget.area_acres === null ? null : Number(budget.area_acres),
      expected_yield_kg: budget.expected_yield_kg === null ? null : Number(budget.expected_yield_kg),
      target_price_per_kg: budget.target_price_per_kg === null ? null : Number(budget.target_price_per_kg),
      entries: [],
    };
  });
}

async function addFarmBudgetEntry({ farmId, budgetId, actorId, type, category, amount, entryDate, note }) {
  if (!['income', 'expense'].includes(type)) throw operationError('invalid_budget_entry_type');
  const normalizedCategory = requiredText(category, 'category', 80);
  const normalizedAmount = optionalAmount(amount, 'amount');
  if (normalizedAmount === null) throw operationError('invalid_amount');
  const normalizedDate = optionalDate(entryDate, 'entry_date');
  if (!normalizedDate) throw operationError('invalid_entry_date');
  const normalizedNote = optionalText(note, 'note', 1000);
  return knex.transaction(async (transaction) => {
    const membership = await assertActiveFarmMember(transaction, farmId, actorId);
    if (!['owner', 'manager'].includes(membership.role)) throw operationError('farm_budget_not_authorized', 403);
    const budget = await transaction('farm_season_budgets').where({ budget_id: budgetId, farm_id: farmId }).first();
    if (!budget) throw operationError('farm_budget_not_found', 404);
    if (budget.start_date && normalizedDate < String(budget.start_date).slice(0, 10)) throw operationError('entry_before_season', 400);
    if (budget.end_date && normalizedDate > String(budget.end_date).slice(0, 10)) throw operationError('entry_after_season', 400);
    const [entry] = await transaction('farm_budget_entries').insert({
      budget_id: budgetId,
      type,
      category: normalizedCategory,
      amount: normalizedAmount,
      entry_date: normalizedDate,
      note: normalizedNote,
      created_by: actorId,
    }).returning('*');
    await recordAudit(transaction, { farmId, actorId, action: `budget_${type}_recorded`, targetType: 'budget_entry', targetId: entry.entry_id });
    return { ...entry, amount: Number(entry.amount) };
  });
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function boundedCoordinate(value, minimum, maximum, field) {
  const coordinate = Number(value);
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) {
    throw operationError(`invalid_${field}`);
  }
  return coordinate;
}

function normalizeActivityLocation(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw operationError('invalid_location');
  const accuracy = value.accuracy_m === undefined || value.accuracy_m === null || value.accuracy_m === ''
    ? null
    : Number(value.accuracy_m);
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1000000)) {
    throw operationError('invalid_location_accuracy');
  }
  return {
    latitude: boundedCoordinate(value.latitude, -90, 90, 'latitude'),
    longitude: boundedCoordinate(value.longitude, -180, 180, 'longitude'),
    accuracy_m: accuracy,
    altitude_m: value.altitude_m === null || value.altitude_m === undefined
      ? null
      : boundedCoordinate(value.altitude_m, -1000, 100000, 'altitude'),
    captured_at: typeof value.captured_at === 'string' && !Number.isNaN(Date.parse(value.captured_at))
      ? new Date(value.captured_at).toISOString()
      : null,
  };
}

function normalizeActivityWeather(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw operationError('invalid_weather');
  const numberOrNull = (number, field, minimum, maximum) => {
    if (number === undefined || number === null || number === '') return null;
    const parsed = Number(number);
    if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw operationError(`invalid_${field}`);
    return parsed;
  };
  return {
    temperature_c: numberOrNull(value.temperature_c, 'temperature', -80, 70),
    humidity_percent: numberOrNull(value.humidity_percent, 'humidity', 0, 100),
    wind_kmh: numberOrNull(value.wind_kmh, 'wind_speed', 0, 400),
    wind_direction: optionalText(value.wind_direction, 'wind_direction', 40),
    conditions: optionalText(value.conditions, 'weather_conditions', 100),
    source: requiredText(value.source, 'weather_source', 120),
    location: optionalText(value.location, 'weather_location', 160),
    observed_at: typeof value.observed_at === 'string' && !Number.isNaN(Date.parse(value.observed_at))
      ? new Date(value.observed_at).toISOString()
      : null,
  };
}

function normalizeActivityPhoto(value, location) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw operationError('invalid_evidence');
  const name = requiredText(value.name, 'evidence_name', 160);
  const mimeType = value.mime_type;
  const dataUrl = value.data_url;
  const capturedAt = Date.parse(value.captured_at);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
    || typeof dataUrl !== 'string'
    || dataUrl.length > 1500000
    || !dataUrl.startsWith(`data:${mimeType};base64,`)
    || !Number.isFinite(capturedAt)
    || !location?.captured_at
    || Math.abs(capturedAt - Date.parse(location.captured_at)) > 15 * 60 * 1000) {
    throw operationError('invalid_evidence');
  }
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw operationError('invalid_evidence');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0 || bytes.length > 1000000) throw operationError('evidence_too_large');
  return {
    name,
    mimeType,
    dataUrl,
    capturedAt: new Date(capturedAt).toISOString(),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

async function listFarmActivityLogs({ farmId, userId }) {
  await assertActiveFarmMember(knex, farmId, userId);
  const logs = await knex('farm_activity_logs as logs')
    .join('users', 'users.user_id', 'logs.actor_id')
    .where('logs.farm_id', farmId)
    .select(
      'logs.sequence',
      'logs.activity_id',
      'logs.farm_id',
      'logs.actor_id',
      'logs.activity_date',
      'logs.crop',
      'logs.activity_type',
      'logs.field_name',
      'logs.details',
      'logs.location',
      'logs.weather',
      'logs.photo_name',
      'logs.photo_mime_type',
      'logs.previous_hash',
      'logs.content_hash',
      'logs.recorded_at',
      'users.name as actor_name',
    )
    .orderBy('logs.sequence', 'desc')
    .limit(100);
  return logs.map((log) => ({
    ...log,
    sequence: Number(log.sequence),
    has_evidence: Boolean(log.photo_name),
  }));
}

async function getFarmActivityEvidence({ farmId, activityId, userId }) {
  await assertActiveFarmMember(knex, farmId, userId);
  const evidence = await knex('farm_activity_logs')
    .where({ farm_id: farmId, activity_id: activityId })
    .select('photo_name', 'photo_mime_type', 'photo_data', 'photo_sha256')
    .first();
  if (!evidence || !evidence.photo_data) throw operationError('activity_evidence_not_found', 404);
  return evidence;
}

async function createFarmActivityLog({
  farmId,
  actorId,
  activityDate,
  crop,
  activityType,
  fieldName,
  details,
  location,
  weather,
  evidence,
}) {
  const normalizedDate = optionalDate(activityDate, 'activity_date');
  if (!normalizedDate) throw operationError('invalid_activity_date');
  const normalizedCrop = requiredText(crop, 'crop', 100);
  if (!farmActivityTypes.has(activityType)) throw operationError('invalid_activity_type');
  const normalizedFieldName = optionalText(fieldName, 'field_name', 120);
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw operationError('invalid_activity_details');
  const normalizedDetails = {
    product_name: optionalText(details.product_name, 'product_name', 120),
    dosage_rate: optionalText(details.dosage_rate, 'dosage_rate', 80),
    water_volume_liters: optionalAmount(details.water_volume_liters, 'water_volume'),
    equipment: optionalText(details.equipment, 'equipment', 120),
    notes: optionalText(details.notes, 'notes', 1000),
  };
  const normalizedLocation = normalizeActivityLocation(location);
  const normalizedWeather = normalizeActivityWeather(weather);
  const normalizedEvidence = normalizeActivityPhoto(evidence, normalizedLocation);
  if (!normalizedLocation || normalizedLocation.accuracy_m === null || normalizedLocation.accuracy_m > 50) {
    throw operationError('activity_location_required');
  }
  if (!normalizedLocation.captured_at
    || Math.abs(Date.now() - Date.parse(normalizedLocation.captured_at)) > 15 * 60 * 1000) {
    throw operationError('activity_location_stamp_expired');
  }
  if (!normalizedEvidence) throw operationError('activity_evidence_required');

  return knex.transaction(async (transaction) => {
    const membership = await assertActiveFarmMember(transaction, farmId, actorId);
    if (!['owner', 'manager', 'worker'].includes(membership.role)) {
      throw operationError('farm_activity_not_authorized', 403);
    }
    const farm = await transaction('farms').where({ farm_id: farmId }).forUpdate().first();
    if (!farm) throw operationError('farm_not_found', 404);
    const previous = await transaction('farm_activity_logs')
      .where({ farm_id: farmId })
      .orderBy('sequence', 'desc')
      .select('content_hash')
      .first();
    const sequenceResult = await transaction.raw(
      "SELECT nextval(pg_get_serial_sequence('farm_activity_logs', 'sequence')) AS sequence",
    );
    const sequence = Number(sequenceResult.rows?.[0]?.sequence);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw operationError('activity_sequence_unavailable', 500);
    const recordedAt = new Date();
    const previousHash = previous?.content_hash || null;
    const hashContent = {
      sequence,
      farmId,
      actorId,
      activityDate: normalizedDate,
      crop: normalizedCrop,
      activityType,
      fieldName: normalizedFieldName,
      details: normalizedDetails,
      location: normalizedLocation,
      weather: normalizedWeather,
      evidenceSha256: normalizedEvidence?.sha256 || null,
      recordedAt: recordedAt.toISOString(),
      previousHash,
    };
    const contentHash = crypto.createHash('sha256').update(canonicalJson(hashContent)).digest('hex');
    const [log] = await transaction('farm_activity_logs').insert({
      sequence,
      farm_id: farmId,
      actor_id: actorId,
      activity_date: normalizedDate,
      crop: normalizedCrop,
      activity_type: activityType,
      field_name: normalizedFieldName,
      details: JSON.stringify(normalizedDetails),
      location: normalizedLocation ? JSON.stringify(normalizedLocation) : null,
      weather: normalizedWeather ? JSON.stringify(normalizedWeather) : null,
      photo_name: normalizedEvidence?.name || null,
      photo_mime_type: normalizedEvidence?.mimeType || null,
      photo_data: normalizedEvidence?.dataUrl || null,
      photo_sha256: normalizedEvidence?.sha256 || null,
      previous_hash: previousHash,
      content_hash: contentHash,
      recorded_at: recordedAt,
    }).returning([
      'sequence',
      'activity_id',
      'farm_id',
      'actor_id',
      'activity_date',
      'crop',
      'activity_type',
      'field_name',
      'details',
      'location',
      'weather',
      'photo_name',
      'photo_mime_type',
      'previous_hash',
      'content_hash',
      'recorded_at',
    ]);
    await recordAudit(transaction, {
      farmId,
      actorId,
      action: 'farm_activity_log_finalized',
      targetType: 'activity_log',
      targetId: log.activity_id,
      metadata: { sequence, content_hash: contentHash },
    });
    return { ...log, sequence: Number(log.sequence), has_evidence: Boolean(log.photo_name) };
  });
}

async function inviteFarmMember({ farmId, actorId, email, role }) {
  if (!['manager', 'worker', 'adviser'].includes(role)) throw operationError('invalid_farm_role');
  const normalizedEmail = requiredText(email, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw operationError('invalid_email');
  return knex.transaction(async (transaction) => {
    const membership = await getMembership(transaction, farmId, actorId);
    if (membership.role !== 'owner') throw operationError('farm_owner_required', 403);
    const invitee = await transaction('users')
      .whereRaw('LOWER(email) = ?', [normalizedEmail])
      .where('role_status', 'active')
      .select('user_id', 'name')
      .first();
    if (!invitee) throw operationError('account_not_found', 404);
    if (invitee.user_id === actorId) throw operationError('cannot_invite_self');
    const existing = await transaction('farm_members')
      .where({ farm_id: farmId, user_id: invitee.user_id })
      .first();
    if (existing && existing.status !== 'declined') throw operationError('farm_member_already_exists', 409);
    let invitation;
    if (existing) {
      [invitation] = await transaction('farm_members')
        .where({ membership_id: existing.membership_id })
        .update({
          role,
          status: 'pending',
          invited_by: actorId,
          updated_at: transaction.fn.now(),
        })
        .returning(['membership_id', 'farm_id', 'user_id', 'role', 'status', 'created_at']);
    } else {
      [invitation] = await transaction('farm_members').insert({
        farm_id: farmId,
        user_id: invitee.user_id,
        role,
        status: 'pending',
        invited_by: actorId,
      }).returning(['membership_id', 'farm_id', 'user_id', 'role', 'status', 'created_at']);
    }
    await recordAudit(transaction, {
      farmId, actorId, action: 'member_invited', targetType: 'member', targetId: invitation.membership_id, metadata: { role },
    });
    return { ...invitation, name: invitee.name };
  });
}

async function respondToFarmInvitation({ membershipId, userId, status }) {
  if (!['active', 'declined'].includes(status)) throw operationError('invalid_invitation_status');
  return knex.transaction(async (transaction) => {
    const invitation = await transaction('farm_members').where({
      membership_id: membershipId,
      user_id: userId,
      status: 'pending',
    }).forUpdate().first();
    if (!invitation) throw operationError('invitation_not_found', 404);
    const [updated] = await transaction('farm_members')
      .where({ membership_id: membershipId })
      .update({ status, updated_at: transaction.fn.now() })
      .returning('*');
    await recordAudit(transaction, {
      farmId: invitation.farm_id, actorId: userId, action: status === 'active' ? 'member_accepted' : 'member_declined',
      targetType: 'member', targetId: membershipId,
    });
    return updated;
  });
}

async function createFarmTask({ farmId, actorId, title, details, assignedTo, dueDate }) {
  const normalizedTitle = requiredText(title, 'title', 120);
  const normalizedDetails = optionalText(details, 'details', 2000);
  const normalizedDate = optionalDate(dueDate, 'due_date');
  return knex.transaction(async (transaction) => {
    const membership = await assertActiveFarmMember(transaction, farmId, actorId);
    if (!['owner', 'manager'].includes(membership.role)) throw operationError('task_assignment_not_authorized', 403);
    if (assignedTo) {
      const assignee = await assertActiveFarmMember(transaction, farmId, assignedTo);
      if (!['worker', 'manager'].includes(assignee.role)) throw operationError('invalid_task_assignee', 400);
    }
    const [task] = await transaction('farm_tasks').insert({
      farm_id: farmId,
      title: normalizedTitle,
      details: normalizedDetails,
      assigned_to: assignedTo || null,
      due_date: normalizedDate,
      created_by: actorId,
    }).returning('*');
    await recordAudit(transaction, { farmId, actorId, action: 'task_created', targetType: 'task', targetId: task.task_id });
    return task;
  });
}

async function updateFarmTask({ farmId, taskId, actorId, status }) {
  if (!['open', 'in_progress', 'completed', 'cancelled'].includes(status)) throw operationError('invalid_task_status');
  return knex.transaction(async (transaction) => {
    const membership = await assertActiveFarmMember(transaction, farmId, actorId);
    const task = await transaction('farm_tasks').where({ task_id: taskId, farm_id: farmId }).forUpdate().first();
    if (!task) throw operationError('task_not_found', 404);
    const mayManage = ['owner', 'manager'].includes(membership.role);
    const assignedWorker = membership.role === 'worker' && task.assigned_to === actorId;
    if (!mayManage && !assignedWorker) throw operationError('task_update_not_authorized', 403);
    if (assignedWorker && !['in_progress', 'completed'].includes(status)) throw operationError('invalid_worker_task_transition', 403);
    if (task.status === 'completed' && status !== 'completed') throw operationError('completed_task_is_final', 409);
    const [updated] = await transaction('farm_tasks')
      .where({ task_id: taskId })
      .update({ status, updated_at: transaction.fn.now() })
      .returning('*');
    await recordAudit(transaction, { farmId, actorId, action: `task_${status}`, targetType: 'task', targetId: taskId });
    return updated;
  });
}

async function createResourceRequest({ farmId, actorId, title, details, quantity, estimatedCost }) {
  const normalizedTitle = requiredText(title, 'title', 120);
  const normalizedDetails = optionalText(details, 'details', 2000);
  const normalizedQuantity = optionalAmount(quantity, 'quantity');
  const normalizedCost = optionalAmount(estimatedCost, 'estimated_cost');
  return knex.transaction(async (transaction) => {
    const membership = await assertActiveFarmMember(transaction, farmId, actorId);
    if (!['owner', 'manager'].includes(membership.role)) throw operationError('resource_request_not_authorized', 403);
    const [request] = await transaction('farm_resource_requests').insert({
      farm_id: farmId,
      title: normalizedTitle,
      details: normalizedDetails,
      quantity: normalizedQuantity,
      estimated_cost: normalizedCost,
      requested_by: actorId,
    }).returning('*');
    await recordAudit(transaction, { farmId, actorId, action: 'resource_requested', targetType: 'resource_request', targetId: request.request_id });
    return request;
  });
}

async function reviewResourceRequest({ farmId, requestId, actorId, status }) {
  if (!['approved', 'declined', 'fulfilled'].includes(status)) throw operationError('invalid_resource_request_status');
  return knex.transaction(async (transaction) => {
    const membership = await assertActiveFarmMember(transaction, farmId, actorId);
    if (status !== 'fulfilled' && membership.role !== 'owner') throw operationError('farm_owner_required', 403);
    if (status === 'fulfilled' && !['owner', 'manager'].includes(membership.role)) throw operationError('resource_fulfillment_not_authorized', 403);
    const request = await transaction('farm_resource_requests').where({ request_id: requestId, farm_id: farmId }).forUpdate().first();
    if (!request) throw operationError('resource_request_not_found', 404);
    if (status === 'fulfilled' && request.status !== 'approved') throw operationError('resource_request_not_approved', 409);
    if (status !== 'fulfilled' && request.status !== 'pending') throw operationError('resource_request_already_reviewed', 409);
    const [updated] = await transaction('farm_resource_requests')
      .where({ request_id: requestId })
      .update({
        status,
        reviewed_by: actorId,
        reviewed_at: transaction.fn.now(),
        updated_at: transaction.fn.now(),
      })
      .returning('*');
    await recordAudit(transaction, { farmId, actorId, action: `resource_request_${status}`, targetType: 'resource_request', targetId: requestId });
    return updated;
  });
}

module.exports = {
  listFarms,
  listOperations,
  listFarmActivityLogs,
  getFarmActivityEvidence,
  createFarmActivityLog,
  createFarmBudget,
  addFarmBudgetEntry,
  inviteFarmMember,
  respondToFarmInvitation,
  createFarmTask,
  updateFarmTask,
  createResourceRequest,
  reviewResourceRequest,
};
