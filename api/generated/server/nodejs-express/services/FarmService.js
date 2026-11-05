const knex = require('../../../../db');

async function createFarm(data) {
  const insertData = {
    user_id: data.user_id,
    name: data.name,
    soil_type: data.soil_type,
    total_acres: data.total_acres,
  };
  if (data.farm_boundary) {
    insertData.farm_boundary = JSON.stringify(data.farm_boundary);
  }
  return knex.transaction(async (transaction) => {
    const [farm] = await transaction('farms').insert(insertData).returning(['farm_id', 'user_id', 'name', 'soil_type', 'total_acres', 'created_at']);
    await transaction('farm_operation_audit').insert({
      farm_id: farm.farm_id,
      actor_id: data.user_id,
      action: 'farm_created',
      target_type: 'farm',
      target_id: farm.farm_id,
      metadata: {},
    });
    return farm;
  });
}

async function getFarmById(farmId, userId) {
  return knex('farms').where({ farm_id: farmId, user_id: userId }).first();
}

module.exports = { createFarm, getFarmById };
