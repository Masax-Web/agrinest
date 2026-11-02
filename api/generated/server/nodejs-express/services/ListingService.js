const knex = require('../../../../db');

async function createListing(data) {
  return knex.transaction(async (trx) => {
    const result = await trx('listings').insert({
      farmer_id: data.farmer_id || null,
      crop_type: data.crop_type || data.name,
      quantity: data.quantity,
      price: data.price,
      name: data.name || data.crop_type,
      category: data.category || 'Grains',
      description: data.description || '',
      image_url: data.image_url || null,
      seller_name: data.seller_name || null,
      region: data.region || null,
      unit: data.unit || null,
    }).returning('*');
    const listing = normalizeListing(Array.isArray(result) ? result[0] : result);
    await createActivity('listing_created', {
      listing_id: listing.listing_id,
      name: listing.name || listing.crop_type,
      category: listing.category,
      region: listing.region,
    }, trx);
    return listing;
  });
}

async function listings() {
  const items = await knex('listings').select('*').orderBy('created_at', 'desc').limit(100);
  return items.map(normalizeListing);
}

function normalizeListing(listing) {
  return { ...listing, quantity: Number(listing.quantity), price: Number(listing.price) };
}

async function createActivity(eventType, details, database = knex) {
  const [activity] = await database('marketplace_activity')
    .insert({ event_type: eventType, details })
    .returning(['activity_id', 'event_type', 'details', 'created_at']);
  return activity;
}

async function activityAfter(activityId) {
  return knex('marketplace_activity')
    .select(['activity_id', 'event_type', 'details', 'created_at'])
    .where('activity_id', '>', activityId)
    .orderBy('activity_id', 'asc')
    .limit(100);
}

async function recentActivity(limit = 12) {
  return knex('marketplace_activity')
    .select(['activity_id', 'event_type', 'details', 'created_at'])
    .orderBy('activity_id', 'desc')
    .limit(limit);
}

async function createOrder(data) {
  const totalAmount = data.items.reduce((total, item) => total + (Number(item.unit_price) * Number(item.quantity)), 0);
  return knex.transaction(async (trx) => {
    const [order] = await trx('marketplace_orders')
      .insert({
        buyer_name: data.buyer_name,
        items: JSON.stringify(data.items),
        total_amount: totalAmount,
      })
      .returning('*');
    await createActivity('order_placed', {
      order_id: order.order_id,
      item_count: data.items.reduce((total, item) => total + item.quantity, 0),
      total_amount: Number(order.total_amount),
    }, trx);
    return order;
  });
}

module.exports = { createActivity, createListing, createOrder, activityAfter, recentActivity, listings };
