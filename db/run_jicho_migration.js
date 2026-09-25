require('dotenv').config();
const Knex = require('knex');
const knexConfig = require('./knexfile');

async function run() {
  const knex = Knex(knexConfig);
  try {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    const hasTable = await knex.schema.hasTable('jicho_scans');
    if (!hasTable) {
      await knex.schema.createTable('jicho_scans', (table) => {
        table.uuid('scan_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('farmer_id').nullable();
        table.text('diagnosis');
        table.decimal('confidence');
        table.text('image_base64');
        table.text('crop');
        table.text('recommended_treatment');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      });
    } else {
      const missingColumns = [];
      for (const column of ['image_base64', 'crop', 'recommended_treatment']) {
        if (!(await knex.schema.hasColumn('jicho_scans', column))) missingColumns.push(column);
      }
      if (missingColumns.length) {
        await knex.schema.alterTable('jicho_scans', (table) => {
          missingColumns.forEach((column) => table.text(column));
        });
      }
    }
    const hasStudentTable = await knex.schema.hasTable('student_dashboards');
    if (!hasStudentTable) {
      await knex.schema.createTable('student_dashboards', (table) => {
        table.string('student_id').primary();
        table.jsonb('dashboard').notNullable();
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
      });
    }
    console.log('Jicho database migration complete.');
  } finally {
    await knex.destroy();
  }
}

run().catch((error) => {
  console.error('Jicho migration failed:', error);
  process.exit(1);
});
