const express = require('express');
const router = express.Router();
const FarmService = require('../services/FarmService');
const FarmOperations = require('../../../../services/FarmOperations');

function handleOperationError(response, error, action) {
  if (error.status) return response.status(error.status).json({ error: error.message });
  console.error(`FarmsController.${action}`, error);
  return response.status(500).json({ error: 'farm_operation_failed' });
}

router.get('/', async (req, res) => {
  try {
    return res.json({ farms: await FarmOperations.listFarms(req.authUser.user_id) });
  } catch (error) {
    return handleOperationError(res, error, 'listFarms');
  }
});

router.get('/location-alerts', async (req, res) => {
  try {
    return res.json({ alerts: await FarmService.listFarmerLocationAlerts(req.authUser.user_id) });
  } catch (error) {
    return handleOperationError(res, error, 'listFarmerLocationAlerts');
  }
});

router.get('/location-reviews', async (req, res) => {
  if (!req.authUser.is_admin) return res.status(403).json({ error: 'admin_access_required' });
  try {
    return res.json({ reviews: await FarmService.listLocationReviews() });
  } catch (error) {
    return handleOperationError(res, error, 'listLocationReviews');
  }
});

router.patch('/location-reviews/:reviewId', async (req, res) => {
  if (!req.authUser.is_admin) return res.status(403).json({ error: 'admin_access_required' });
  try {
    const review = await FarmService.resolveLocationReview(
      req.params.reviewId,
      req.authUser.user_id,
      req.body.status,
    );
    return res.json({ review });
  } catch (error) {
    return handleOperationError(res, error, 'resolveLocationReview');
  }
});

router.post('/', async (req, res) => {
  try {
    const farm = await FarmService.createFarm({ ...req.body, user_id: req.authUser.user_id });
    return res.status(201).json(farm);
  } catch (error) {
    return handleOperationError(res, error, 'createFarm');
  }
});

router.get('/:farmId', async (req, res) => {
  try {
    const farm = await FarmService.getFarmById(req.params.farmId, req.authUser.user_id);
    if (!farm) return res.status(404).json({ error: 'not_found' });
    res.json(farm);
  } catch (err) {
    console.error('FarmsController.get', err);
    res.status(500).json({ error: 'db_error' });
  }
});

router.get('/:farmId/operations', async (req, res) => {
  try {
    const operations = await FarmOperations.listOperations({ farmId: req.params.farmId, userId: req.authUser.user_id });
    return res.json(operations);
  } catch (error) {
    return handleOperationError(res, error, 'listOperations');
  }
});

router.post('/:farmId/members', async (req, res) => {
  try {
    const member = await FarmOperations.inviteFarmMember({
      farmId: req.params.farmId,
      actorId: req.authUser.user_id,
      email: req.body.email,
      role: req.body.role,
    });
    return res.status(201).json({ member });
  } catch (error) {
    return handleOperationError(res, error, 'inviteFarmMember');
  }
});

router.patch('/members/:membershipId', async (req, res) => {
  try {
    const membership = await FarmOperations.respondToFarmInvitation({
      membershipId: req.params.membershipId,
      userId: req.authUser.user_id,
      status: req.body.status,
    });
    return res.json({ membership });
  } catch (error) {
    return handleOperationError(res, error, 'respondToFarmInvitation');
  }
});

router.post('/:farmId/tasks', async (req, res) => {
  try {
    const task = await FarmOperations.createFarmTask({
      farmId: req.params.farmId,
      actorId: req.authUser.user_id,
      title: req.body.title,
      details: req.body.details,
      assignedTo: req.body.assigned_to,
      dueDate: req.body.due_date,
    });
    return res.status(201).json({ task });
  } catch (error) {
    return handleOperationError(res, error, 'createFarmTask');
  }
});

router.patch('/:farmId/tasks/:taskId', async (req, res) => {
  try {
    const task = await FarmOperations.updateFarmTask({
      farmId: req.params.farmId,
      taskId: req.params.taskId,
      actorId: req.authUser.user_id,
      status: req.body.status,
    });
    return res.json({ task });
  } catch (error) {
    return handleOperationError(res, error, 'updateFarmTask');
  }
});

router.post('/:farmId/resource-requests', async (req, res) => {
  try {
    const resourceRequest = await FarmOperations.createResourceRequest({
      farmId: req.params.farmId,
      actorId: req.authUser.user_id,
      title: req.body.title,
      details: req.body.details,
      quantity: req.body.quantity,
      estimatedCost: req.body.estimated_cost,
    });
    return res.status(201).json({ request: resourceRequest });
  } catch (error) {
    return handleOperationError(res, error, 'createResourceRequest');
  }
});

router.patch('/:farmId/resource-requests/:requestId', async (req, res) => {
  try {
    const resourceRequest = await FarmOperations.reviewResourceRequest({
      farmId: req.params.farmId,
      requestId: req.params.requestId,
      actorId: req.authUser.user_id,
      status: req.body.status,
    });
    return res.json({ request: resourceRequest });
  } catch (error) {
    return handleOperationError(res, error, 'reviewResourceRequest');
  }
});

router.get('/:farmId/activity-logs', async (req, res) => {
  try {
    const logs = await FarmOperations.listFarmActivityLogs({
      farmId: req.params.farmId,
      userId: req.authUser.user_id,
    });
    return res.json({ logs });
  } catch (error) {
    return handleOperationError(res, error, 'listFarmActivityLogs');
  }
});

router.post('/:farmId/activity-logs', async (req, res) => {
  try {
    const log = await FarmOperations.createFarmActivityLog({
      farmId: req.params.farmId,
      actorId: req.authUser.user_id,
      activityDate: req.body.activity_date,
      crop: req.body.crop,
      activityType: req.body.activity_type,
      fieldName: req.body.field_name,
      details: req.body.details,
      location: req.body.location,
      weather: req.body.weather,
      evidence: req.body.evidence,
    });
    return res.status(201).json({ log });
  } catch (error) {
    return handleOperationError(res, error, 'createFarmActivityLog');
  }
});

router.get('/:farmId/activity-logs/:activityId/evidence', async (req, res) => {
  try {
    const evidence = await FarmOperations.getFarmActivityEvidence({
      farmId: req.params.farmId,
      activityId: req.params.activityId,
      userId: req.authUser.user_id,
    });
    return res.json({
      evidence: {
        name: evidence.photo_name,
        mime_type: evidence.photo_mime_type,
        data_url: evidence.photo_data,
        sha256: evidence.photo_sha256,
      },
    });
  } catch (error) {
    return handleOperationError(res, error, 'getFarmActivityEvidence');
  }
});

router.post('/:farmId/budgets', async (req, res) => {
  try {
    const budget = await FarmOperations.createFarmBudget({
      farmId: req.params.farmId,
      actorId: req.authUser.user_id,
      title: req.body.title,
      crop: req.body.crop,
      fieldId: req.body.field_id,
      areaAcres: req.body.area_acres,
      expectedYieldKg: req.body.expected_yield_kg,
      targetPricePerKg: req.body.target_price_per_kg,
      plannedCosts: req.body.planned_costs,
      startDate: req.body.start_date,
      endDate: req.body.end_date,
    });
    return res.status(201).json({ budget });
  } catch (error) {
    return handleOperationError(res, error, 'createFarmBudget');
  }
});

router.post('/:farmId/budgets/:budgetId/entries', async (req, res) => {
  try {
    const entry = await FarmOperations.addFarmBudgetEntry({
      farmId: req.params.farmId,
      budgetId: req.params.budgetId,
      actorId: req.authUser.user_id,
      type: req.body.type,
      category: req.body.category,
      amount: req.body.amount,
      entryDate: req.body.entry_date,
      note: req.body.note,
    });
    return res.status(201).json({ entry });
  } catch (error) {
    return handleOperationError(res, error, 'addFarmBudgetEntry');
  }
});

module.exports = router;
