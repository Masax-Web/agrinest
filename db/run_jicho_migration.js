require('dotenv').config();
const Knex = require('knex');
const knexConfig = require('./knexfile');

async function run() {
  const knex = Knex(knexConfig);
  try {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    const hasUsersTable = await knex.schema.hasTable('users');
    if (!hasUsersTable) {
      await knex.schema.createTable('users', (table) => {
        table.uuid('user_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('phone', 32).notNullable().unique();
        table.text('name');
        table.text('nida_number');
        table.text('role');
        table.decimal('trust_score').defaultTo(0);
        table.text('region');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
      });
    }

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

    const hasListingsTable = await knex.schema.hasTable('listings');
    if (!hasListingsTable) {
      await knex.schema.createTable('listings', (table) => {
        table.uuid('listing_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('farmer_id').nullable().references('user_id').inTable('users');
        table.text('crop_type').notNullable();
        table.decimal('quantity').notNullable();
        table.decimal('price').notNullable().defaultTo(0);
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      });
    }
    const listingColumns = {
      name: (table) => table.text('name'),
      category: (table) => table.text('category'),
      description: (table) => table.text('description'),
      image_url: (table) => table.text('image_url'),
      seller_name: (table) => table.text('seller_name'),
      region: (table) => table.text('region'),
      unit: (table) => table.text('unit'),
    };
    for (const [column, createColumn] of Object.entries(listingColumns)) {
      if (!(await knex.schema.hasColumn('listings', column))) {
        await knex.schema.alterTable('listings', createColumn);
      }
    }

    if (!(await knex.schema.hasTable('marketplace_orders'))) {
      await knex.schema.createTable('marketplace_orders', (table) => {
        table.uuid('order_id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.text('buyer_name').notNullable();
        table.jsonb('items').notNullable();
        table.decimal('total_amount').notNullable();
        table.text('status').notNullable().defaultTo('placed');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      });
    }

    if (!(await knex.schema.hasTable('marketplace_activity'))) {
      await knex.schema.createTable('marketplace_activity', (table) => {
        table.increments('activity_id').primary();
        table.text('event_type').notNullable();
        table.jsonb('details').notNullable().defaultTo('{}');
        table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
      });
    }
    await knex.schema.raw('CREATE INDEX IF NOT EXISTS marketplace_activity_created_at_idx ON marketplace_activity (activity_id)');
    console.log('Jicho database migration complete.');
  } finally {
    await knex.destroy();
  }
}

run().catch((error) => {
  console.error('Jicho migration failed:', error);
  process.exit(1);
});
