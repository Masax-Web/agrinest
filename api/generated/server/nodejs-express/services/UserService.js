const knex = require('../../../../db');

async function createUser(phone, name) {
  const result = await knex('users')
    .insert({ phone, name, role: 'user', persona_id: 'community_member' })
    .returning(['user_id', 'phone', 'name', 'role', 'persona_id']);
  return Array.isArray(result) ? result[0] : result;
}

async function listPublicUsers() {
  return knex('users')
    .select('user_id', 'name', 'role', 'persona_id', 'region', 'trust_score', 'avatar_url')
    .whereNotNull('name')
    .orderBy('name')
    .limit(200);
}

module.exports = { createUser, listPublicUsers };
