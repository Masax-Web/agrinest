const express = require('express');
const AgriKnowledgeService = require('../services/AgriKnowledgeService');

const router = express.Router();

router.get('/', async (_request, response) => {
  try {
    return response.json(await AgriKnowledgeService.getCatalog());
  } catch (error) {
    console.error('AgriKnowledgeController.getCatalog', error.message);
    return response.status(503).json({ error: 'agricultural_knowledge_unavailable' });
  }
});

router.get('/images', async (request, response) => {
  try {
    return response.json(await AgriKnowledgeService.getIllustrations(request.query.type, request.query.id));
  } catch (error) {
    if (error.status) return response.status(error.status).json({ error: error.message });
    console.error('AgriKnowledgeController.getIllustrations', error.message);
    return response.status(503).json({ error: 'knowledge_images_unavailable' });
  }
});

module.exports = router;
