const knex = require('../db');

function procurementError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw procurementError(`invalid_${field}`);
  }
  return value.trim();
}

function assertAmount(value, field, minimum = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= minimum || amount > 1000000000000) {
    throw procurementError(`invalid_${field}`);
  }
  return amount;
}

function assertDeliveryDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw procurementError('invalid_delivery_date');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    || value < new Date().toISOString().slice(0, 10)) {
    throw procurementError('invalid_delivery_date');
  }
  return value;
}

async function listRfqs(userId) {
  const rows = await knex('feed_rfqs as rfqs')
    .join('users as buyers', 'buyers.user_id', 'rfqs.buyer_id')
    .leftJoin('feed_rfq_bids as bids', 'bids.rfq_id', 'rfqs.rfq_id')
    .where((query) => query.where('rfqs.status', 'open').orWhere('rfqs.buyer_id', userId))
    .groupBy('rfqs.rfq_id', 'buyers.name')
    .select(
      'rfqs.rfq_id',
      'rfqs.buyer_id',
      'buyers.name as buyer_name',
      'rfqs.feed_type',
      'rfqs.quantity_bags',
      'rfqs.required_delivery_date',
      'rfqs.specifications',
      'rfqs.status',
      'rfqs.created_at',
      knex.raw('COUNT(DISTINCT bids.bid_id)::integer AS bid_count')
    )
    .orderBy('rfqs.created_at', 'desc')
    .limit(200);
  return rows;
}

async function createRfq({ buyerId, feedType, quantityBags, deliveryDate, specifications = '' }) {
  const feed = assertText(feedType, 'feed_type', 120);
  const quantity = Number(quantityBags);
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100000000) {
    throw procurementError('invalid_quantity_bags');
  }
  const date = assertDeliveryDate(deliveryDate);
  if (typeof specifications !== 'string' || specifications.length > 2000) {
    throw procurementError('invalid_specifications');
  }
  const [rfq] = await knex('feed_rfqs').insert({
    buyer_id: buyerId,
    feed_type: feed,
    quantity_bags: quantity,
    required_delivery_date: date,
    specifications: specifications.trim(),
  }).returning('*');
  return rfq;
}

async function listBids(rfqId, buyerId) {
  const rfq = await knex('feed_rfqs').where({ rfq_id: rfqId, buyer_id: buyerId }).first();
  if (!rfq) throw procurementError('rfq_not_found', 404);
  return knex('feed_rfq_bids as bids')
    .join('users as suppliers', 'suppliers.user_id', 'bids.supplier_id')
    .where('bids.rfq_id', rfqId)
    .select(
      'bids.bid_id',
      'bids.rfq_id',
      'bids.supplier_id',
      'suppliers.name as supplier_name',
      'suppliers.role as supplier_role',
      'bids.price_per_bag',
      'bids.delivery_fee',
      'bids.notes',
      'bids.status',
      'bids.created_at'
    )
    .orderBy('bids.price_per_bag', 'asc')
    .orderBy('bids.created_at', 'asc');
}

async function submitBid({ rfqId, supplierId, pricePerBag, deliveryFee = 0, notes = '' }) {
  const price = assertAmount(pricePerBag, 'price_per_bag');
  const fee = Number(deliveryFee);
  if (!Number.isFinite(fee) || fee < 0 || fee > 1000000000000) {
    throw procurementError('invalid_delivery_fee');
  }
  if (typeof notes !== 'string' || notes.length > 2000) throw procurementError('invalid_bid_notes');

  return knex.transaction(async (transaction) => {
    const rfq = await transaction('feed_rfqs').where({ rfq_id: rfqId }).forUpdate().first();
    if (!rfq) throw procurementError('rfq_not_found', 404);
    if (rfq.status !== 'open') throw procurementError('rfq_not_open', 409);
    if (rfq.buyer_id === supplierId) throw procurementError('cannot_bid_on_own_rfq', 403);
    const [bid] = await transaction('feed_rfq_bids')
      .insert({
        rfq_id: rfqId,
        supplier_id: supplierId,
        price_per_bag: price,
        delivery_fee: fee,
        notes: notes.trim(),
      })
      .onConflict(['rfq_id', 'supplier_id'])
      .merge({
        price_per_bag: price,
        delivery_fee: fee,
        notes: notes.trim(),
        status: 'submitted',
        updated_at: transaction.fn.now(),
      })
      .returning('*');
    return bid;
  });
}

async function acceptBid({ rfqId, bidId, buyerId }) {
  return knex.transaction(async (transaction) => {
    const rfq = await transaction('feed_rfqs')
      .where({ rfq_id: rfqId, buyer_id: buyerId })
      .forUpdate()
      .first();
    if (!rfq) throw procurementError('rfq_not_found', 404);
    if (rfq.status !== 'open') throw procurementError('rfq_not_open', 409);
    const bid = await transaction('feed_rfq_bids')
      .where({ rfq_id: rfqId, bid_id: bidId })
      .forUpdate()
      .first();
    if (!bid || bid.status !== 'submitted') throw procurementError('bid_not_found', 404);

    await transaction('feed_rfq_bids')
      .where({ rfq_id: rfqId })
      .update({ status: 'not_selected', updated_at: transaction.fn.now() });
    const [acceptedBid] = await transaction('feed_rfq_bids')
      .where({ bid_id: bidId })
      .update({ status: 'accepted', updated_at: transaction.fn.now() })
      .returning('*');
    const [updatedRfq] = await transaction('feed_rfqs')
      .where({ rfq_id: rfqId })
      .update({ status: 'awarded', updated_at: transaction.fn.now() })
      .returning('*');
    return { rfq: updatedRfq, bid: acceptedBid };
  });
}

async function closeRfq({ rfqId, buyerId }) {
  const [rfq] = await knex('feed_rfqs')
    .where({ rfq_id: rfqId, buyer_id: buyerId, status: 'open' })
    .update({ status: 'closed', updated_at: knex.fn.now() })
    .returning('*');
  if (!rfq) throw procurementError('rfq_not_found_or_not_open', 404);
  return rfq;
}

module.exports = { acceptBid, closeRfq, createRfq, listBids, listRfqs, submitBid };
