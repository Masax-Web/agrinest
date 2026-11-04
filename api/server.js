require('dotenv').config();
const path = require('path');
const express = require('express');
const app = require('./generated/server/nodejs-express/app');
const knex = require('./db');
const { ensureAuthSchema } = require('./services/AuthSchema');
const { ensureProcurementSchema } = require('./services/ProcurementSchema');
const { ensureSpaceRentalSchema } = require('./services/SpaceRentalService');
const { ensureCrossRoleWorkflowSchema } = require('./services/CrossRoleWorkflows');

const port = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res, next) => {
	if (req.path.startsWith('/api')) return next();
	res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});
async function startServer() {
	await ensureAuthSchema(knex);
	await ensureProcurementSchema(knex);
	await ensureSpaceRentalSchema(knex);
	await ensureCrossRoleWorkflowSchema(knex);
	return app.listen(port, () => console.log(`AGRI-NEST API listening on http://localhost:${port}`));
}

startServer().catch((error) => {
	console.error('AGRI-NEST startup failed:', error.message);
	process.exitCode = 1;
});
