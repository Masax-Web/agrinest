async function ensureProcurementSchema(knex) {
  await knex.raw(`CREATE TABLE IF NOT EXISTS feed_rfqs (
    rfq_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    feed_type TEXT NOT NULL,
    quantity_bags INTEGER NOT NULL CHECK (quantity_bags > 0),
    required_delivery_date DATE NOT NULL,
    specifications TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'awarded', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await knex.raw('CREATE INDEX IF NOT EXISTS feed_rfqs_status_created_idx ON feed_rfqs (status, created_at DESC)');
  await knex.raw(`CREATE TABLE IF NOT EXISTS feed_rfq_bids (
    bid_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES feed_rfqs(rfq_id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    price_per_bag NUMERIC(14, 2) NOT NULL CHECK (price_per_bag > 0),
    delivery_fee NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'not_selected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT feed_rfq_bids_one_per_supplier UNIQUE (rfq_id, supplier_id)
  )`);
  await knex.raw('CREATE INDEX IF NOT EXISTS feed_rfq_bids_rfq_created_idx ON feed_rfq_bids (rfq_id, created_at)');
}

module.exports = { ensureProcurementSchema };
