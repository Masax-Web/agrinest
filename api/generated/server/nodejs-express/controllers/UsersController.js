const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');

router.get('/', async (req, res) => {
  try {
    const users = await UserService.listPublicUsers();
    res.json({ items: users });
  } catch (err) {
    console.error('UsersController.listPublic', err);
    res.status(500).json({ error: 'db_error' });
  }
});

router.post('/', async (req, res) => {
  const { phone, name } = req.body;
  try {
    const user = await UserService.createUser(phone, name);
    res.status(201).json(user);
  } catch (err) {
    console.error('UsersController.create', err);
    res.status(500).json({ error: 'db_error' });
  }
});

module.exports = router;
