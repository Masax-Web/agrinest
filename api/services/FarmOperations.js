const knex = require('../db');

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
  createFarmBudget,
  addFarmBudgetEntry,
  inviteFarmMember,
  respondToFarmInvitation,
  createFarmTask,
  updateFarmTask,
  createResourceRequest,
  reviewResourceRequest,
};
