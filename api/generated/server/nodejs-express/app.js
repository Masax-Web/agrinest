const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const OpenApiValidator = require('express-openapi-validator');
const authController = require('./controllers/AuthController');
const usersController = require('./controllers/UsersController');
const farmsController = require('./controllers/FarmsController');
const fieldsController = require('./controllers/FieldsController');
const jichoController = require('./controllers/JichoController');
const sokoController = require('./controllers/SokoController');
const communicationsController = require('../../../controllers/CommunicationsController');
const cyberThreatController = require('../../../controllers/CyberThreatController');
const communityController = require('../../../controllers/CommunityController');
const studentsController = require('../../../controllers/StudentsController');
const { authenticate, requireAdmin } = require('../../../middleware/auth');

const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    process.env.APP_BASE_URL,
  ].filter(Boolean).map((value) => value.replace(/\/+$/, '')));
  if (origin && allowedOrigins.has(origin.replace(/\/+$/, ''))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../../../../dist')));
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

const apiSpec = path.join(__dirname, '..', '..', '..', 'openapi.yaml');
app.use(
  OpenApiValidator.middleware({
    apiSpec,
    validateRequests: true,
    validateResponses: true,
  })
);

app.use('/communications', communicationsController);
app.use('/security', cyberThreatController);
app.use('/auth', authController);
app.use('/users', authenticate, requireAdmin, usersController);
app.use('/farms', authenticate, farmsController);
app.use('/fields', authenticate, fieldsController);
app.use('/jicho', authenticate, jichoController);
app.use('/soko', sokoController);
app.use('/community', authenticate, communityController);
app.use('/students', authenticate, studentsController);

app.use((err, req, res, next) => {
  if (err && err.status && err.errors) {
    return res.status(err.status).json({ error: err.message, errors: err.errors });
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

module.exports = app;
