const knex = require('../../../../db');

async function createUser({ phone, name, role = 'farmer', region = null, nida_number = null, trust_score = 0 }) {
  if (!phone) {
    throw new Error('phone_required');
  }

  const existing = await knex('users').where({ phone }).first();
  if (existing) {
    return {
      ...existing,
      user_id: existing.user_id,
      phone: existing.phone,
      name: existing.name,
      role: existing.role || role,
      region: existing.region || region,
    };
  }

  const [user] = await knex('users')
    .insert({
      phone,
      name,
      role,
      region,
      nida_number,
      trust_score,
    })
    .returning(['user_id', 'phone', 'name', 'role', 'region', 'trust_score']);

  return user;
}

async function loginUser(phone, password) {
  const user = await knex('users').where({ phone }).first();
  if (!user) {
    return null;
  }

  const token = `token_${user.user_id}`;
  return {
    token,
    user: {
      user_id: user.user_id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      region: user.region,
      trust_score: user.trust_score,
    },
  };
}

module.exports = { createUser, loginUser };
