require('dotenv').config();
const path = require('path');
const express = require('express');
const app = require('./generated/server/nodejs-express/app');

const port = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, '..', 'dist')));
app.get('*', (req, res, next) => {
	if (req.path.startsWith('/api')) return next();
	res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});
app.listen(port, () => console.log(`AGRI-NEST API stub listening on http://localhost:${port}`));
