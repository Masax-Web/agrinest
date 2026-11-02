const knex = require('../../../../db');

async function createUser(phone, name) {
  const result = await knex('users').insert({ phone, name }).returning(['user_id', 'phone', 'name']);
  return Array.isArray(result) ? result[0] : result;
}

async function listPublicUsers() {
  return knex('users')
    .select('user_id', 'name', 'role', 'region', 'trust_score')
    .whereNotNull('name')
    .orderBy('name')
    .limit(200);
}

module.exports = { createUser, listPublicUsers };
