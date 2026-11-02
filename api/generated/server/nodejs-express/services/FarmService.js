const knex = require('../../../../db');

async function createFarm(data) {
  const insertData = {
    user_id: data.user_id,
    name: data.name,
    soil_type: data.soil_type,
    total_acres: data.total_acres,
  };
  if (data.farm_boundary) {
    insertData.farm_boundary = knex.raw('ST_GeomFromGeoJSON(?)', [JSON.stringify(data.farm_boundary)]);
  }
  const result = await knex('farms').insert(insertData).returning(['farm_id', 'user_id', 'name']);
  return Array.isArray(result) ? result[0] : result;
}

async function getFarmById(farmId, userId) {
  return knex('farms').where({ farm_id: farmId, user_id: userId }).first();
}

module.exports = { createFarm, getFarmById };
