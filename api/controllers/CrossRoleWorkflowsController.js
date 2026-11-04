const express = require('express');
const workflows = require('../services/CrossRoleWorkflows');

const router = express.Router();

function handleError(response, error, action) {
  if (error.status) return response.status(error.status).json({ error: error.message });
  console.error(`CrossRoleWorkflowsController.${action}`, error);
  return response.status(500).json({ error: 'workflow_error' });
}

router.get('/workforce/profile', async (req, res) => {
  try {
    return res.json({ profile: await workflows.getWorkforceProfile(req.authUser.user_id) });
  } catch (error) {
    return handleError(res, error, 'getWorkforceProfile');
  }
});

router.put('/workforce/profile', async (req, res) => {
  try {
    const profile = await workflows.upsertWorkforceProfile({ user: req.authUser, ...req.body });
    return res.json({ profile });
  } catch (error) {
    return handleError(res, error, 'upsertWorkforceProfile');
  }
});

router.get('/workforce/jobs', async (req, res) => {
  try {
    if (req.query.mine === 'true' && req.authUser.role !== 'farmer') {
      return res.status(403).json({ error: 'role_not_authorized' });
    }
    const items = await workflows.listWorkforceJobs({ userId: req.authUser.user_id, mine: req.query.mine === 'true' });
    return res.json({ items });
  } catch (error) {
    return handleError(res, error, 'listWorkforceJobs');
  }
});

router.post('/workforce/jobs', async (req, res) => {
  try {
    const job = await workflows.createWorkforceJob({ employer: req.authUser, ...req.body });
    return res.status(201).json({ job });
  } catch (error) {
    return handleError(res, error, 'createWorkforceJob');
  }
});

router.get('/workforce/applications/mine', async (req, res) => {
  try {
    return res.json({ items: await workflows.listMyWorkforceApplications(req.authUser.user_id) });
  } catch (error) {
    return handleError(res, error, 'listMyWorkforceApplications');
  }
});

router.post('/workforce/jobs/:jobId/applications', async (req, res) => {
  try {
    const application = await workflows.applyToWorkforceJob({
      applicant: req.authUser,
      jobId: req.params.jobId,
      message: req.body.message,
    });
    return res.status(201).json({ application });
  } catch (error) {
    return handleError(res, error, 'applyToWorkforceJob');
  }
});

router.get('/workforce/jobs/:jobId/applications', async (req, res) => {
  try {
    const items = await workflows.listJobApplications({ jobId: req.params.jobId, employerId: req.authUser.user_id });
    return res.json({ items });
  } catch (error) {
    return handleError(res, error, 'listJobApplications');
  }
});

router.patch('/workforce/applications/:applicationId', async (req, res) => {
  try {
    const application = await workflows.updateWorkforceApplication({
      applicationId: req.params.applicationId,
      employerId: req.authUser.user_id,
      status: req.body.status,
    });
    return res.json({ application });
  } catch (error) {
    return handleError(res, error, 'updateWorkforceApplication');
  }
});

router.get('/transport/requests/mine', async (req, res) => {
  try {
    return res.json({ items: await workflows.listMyTransportRequests(req.authUser.user_id) });
  } catch (error) {
    return handleError(res, error, 'listMyTransportRequests');
  }
});

router.get('/transport/requests', async (req, res) => {
  try {
    return res.json({ items: await workflows.listOpenTransportRequests(req.authUser) });
  } catch (error) {
    return handleError(res, error, 'listOpenTransportRequests');
  }
});

router.post('/transport/requests', async (req, res) => {
  try {
    const request = await workflows.createTransportRequest({
      owner: req.authUser,
      pickup: req.body.pickup,
      destination: req.body.destination,
      cargo: req.body.cargo,
      weightKg: req.body.weight_kg,
      pickupDate: req.body.pickup_date,
      details: req.body.details,
    });
    return res.status(201).json({ request });
  } catch (error) {
    return handleError(res, error, 'createTransportRequest');
  }
});

router.post('/transport/requests/:requestId/quotes', async (req, res) => {
  try {
    const quote = await workflows.createTransportQuote({
      provider: req.authUser,
      requestId: req.params.requestId,
      amount: req.body.amount,
      details: req.body.details,
    });
    return res.status(201).json({ quote });
  } catch (error) {
    return handleError(res, error, 'createTransportQuote');
  }
});

router.patch('/transport/quotes/:quoteId', async (req, res) => {
  try {
    const quote = await workflows.updateTransportQuote({
      quoteId: req.params.quoteId,
      ownerId: req.authUser.user_id,
      status: req.body.status,
    });
    return res.json({ quote });
  } catch (error) {
    return handleError(res, error, 'updateTransportQuote');
  }
});

module.exports = router;
