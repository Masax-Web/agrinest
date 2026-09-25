const knex = require('../../../../db');

async function createField(data) {
  const payload = {
    farm_id: data.farm_id,
    name: data.name,
    crop: data.crop,
    planting_date: data.planting_date || null,
    harvest_date: data.harvest_date || null,
  };

  const [field] = await knex('fields')
    .insert(payload)
    .returning(['field_id', 'farm_id', 'name', 'crop', 'planting_date', 'harvest_date']);

  return field;
}

async function getFieldsByFarm(farmId) {
  return knex('fields').where({ farm_id: farmId }).select('*');
}

module.exports = { createField, getFieldsByFarm };
