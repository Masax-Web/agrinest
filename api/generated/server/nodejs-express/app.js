const express = require('express');
const bodyParser = require('body-parser');
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

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../../../../dist')));

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
app.use('/users', usersController);
app.use('/farms', farmsController);
app.use('/fields', fieldsController);
app.use('/jicho', jichoController);
app.use('/soko', sokoController);
app.use('/community', communityController);
app.use('/students', studentsController);

app.use((err, req, res, next) => {
  if (err && err.status && err.errors) {
    return res.status(err.status).json({ error: err.message, errors: err.errors });
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

module.exports = app;
