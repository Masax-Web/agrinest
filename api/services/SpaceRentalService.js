const knex = require('../db');

const spaceTypes = ['farmland', 'dry_storage', 'cold_storage', 'processing'];
const pricePeriods = ['day', 'month', 'season', 'year', 'ton', 'acre'];

function rentalError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw rentalError(`invalid_${field}`);
  }
  return value.trim();
}

function optionalDate(value, field, required = false) {
  if (!value && !required) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw rentalError(`invalid_${field}`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw rentalError(`invalid_${field}`);
  }
  return value;
}

async function ensureSpaceRentalSchema(database) {
  await database.raw(`CREATE TABLE IF NOT EXISTS space_rental_listings (
    space_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    space_type TEXT NOT NULL CHECK (space_type IN ('farmland', 'dry_storage', 'cold_storage', 'processing')),
    description TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL,
    quantity NUMERIC(14, 2) NOT NULL CHECK (quantity > 0),
    unit TEXT NOT NULL,
    price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
    price_period TEXT NOT NULL CHECK (price_period IN ('day', 'month', 'season', 'year', 'ton', 'acre')),
    available_from DATE,
    image_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS space_rental_listings_status_created_idx ON space_rental_listings (status, created_at DESC)');
  await database.raw(`CREATE TABLE IF NOT EXISTS space_rental_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES space_rental_listings(space_id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    requested_from DATE NOT NULL,
    requested_to DATE,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requested_to IS NULL OR requested_to >= requested_from)
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS space_rental_requests_owner_created_idx ON space_rental_requests (owner_id, created_at DESC)');
  await database.raw('CREATE INDEX IF NOT EXISTS space_rental_requests_requester_created_idx ON space_rental_requests (requester_id, created_at DESC)');
}

async function listSpaces() {
  const rows = await knex('space_rental_listings as spaces')
    .join('users as owners', 'owners.user_id', 'spaces.owner_id')
    .where('spaces.status', 'active')
    .select(
      'spaces.space_id', 'spaces.owner_id', 'owners.name as owner_name',
      'spaces.title', 'spaces.space_type', 'spaces.description', 'spaces.region',
      'spaces.quantity', 'spaces.unit', 'spaces.price', 'spaces.price_period',
      'spaces.available_from', 'spaces.image_url', 'spaces.created_at'
    )
    .orderBy('spaces.created_at', 'desc')
    .limit(200);
  return rows.map((space) => ({ ...space, quantity: Number(space.quantity), price: Number(space.price) }));
}

async function listOwnedSpaces(ownerId) {
  const rows = await knex('space_rental_listings')
    .where({ owner_id: ownerId })
    .select(
      'space_id', 'owner_id', 'title', 'space_type', 'description', 'region',
      'quantity', 'unit', 'price', 'price_period', 'available_from', 'image_url', 'status', 'created_at'
    )
    .orderBy('created_at', 'desc')
    .limit(200);
  return rows.map((space) => ({ ...space, quantity: Number(space.quantity), price: Number(space.price) }));
}

async function createSpace({ ownerId, title, type, description = '', region, quantity, unit, price, pricePeriod, availableFrom, imageUrl = '' }) {
  const normalizedTitle = requiredText(title, 'title', 120);
  if (!spaceTypes.includes(type)) throw rentalError('invalid_space_type');
  if (typeof description !== 'string' || description.length > 2000) throw rentalError('invalid_description');
  const normalizedRegion = requiredText(region, 'region', 120);
  const amount = Number(quantity);
  const cost = Number(price);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000) throw rentalError('invalid_quantity');
  if (!Number.isFinite(cost) || cost < 0 || cost > 1000000000000) throw rentalError('invalid_price');
  if (!pricePeriods.includes(pricePeriod)) throw rentalError('invalid_price_period');
  if (typeof imageUrl !== 'string' || imageUrl.length > 2048) throw rentalError('invalid_image_url');
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) throw rentalError('invalid_image_url');
  const [space] = await knex('space_rental_listings').insert({
    owner_id: ownerId,
    title: normalizedTitle,
    space_type: type,
    description: description.trim(),
    region: normalizedRegion,
    quantity: amount,
    unit: requiredText(unit, 'unit', 40),
    price: cost,
    price_period: pricePeriod,
    available_from: optionalDate(availableFrom, 'available_from'),
    image_url: imageUrl.trim(),
  }).returning('*');
  return { ...space, quantity: Number(space.quantity), price: Number(space.price) };
}

async function setSpaceStatus({ spaceId, ownerId, status }) {
  if (!['active', 'inactive'].includes(status)) throw rentalError('invalid_status');
  const [space] = await knex('space_rental_listings')
    .where({ space_id: spaceId, owner_id: ownerId })
    .update({ status, updated_at: knex.fn.now() })
    .returning('*');
  if (!space) throw rentalError('space_not_found', 404);
  return space;
}

async function createSpaceRequest({ spaceId, requesterId, requestedFrom, requestedTo, message = '' }) {
  const start = optionalDate(requestedFrom, 'requested_from', true);
  const end = optionalDate(requestedTo, 'requested_to');
  if (start < new Date().toISOString().slice(0, 10) || (end && end < start)) {
    throw rentalError('invalid_requested_dates');
  }
  if (typeof message !== 'string' || message.length > 2000) throw rentalError('invalid_message');

  const listing = await knex('space_rental_listings').where({ space_id: spaceId, status: 'active' }).first();
  if (!listing) throw rentalError('space_not_found', 404);
  if (listing.owner_id === requesterId) throw rentalError('cannot_request_own_space', 403);
  const [request] = await knex('space_rental_requests').insert({
    space_id: spaceId,
    requester_id: requesterId,
    owner_id: listing.owner_id,
    requested_from: start,
    requested_to: end,
    message: message.trim(),
  }).returning('*');
  return request;
}

async function listSpaceRequests(userId) {
  return knex('space_rental_requests as requests')
    .join('space_rental_listings as spaces', 'spaces.space_id', 'requests.space_id')
    .join('users as requester', 'requester.user_id', 'requests.requester_id')
    .join('users as owner', 'owner.user_id', 'requests.owner_id')
    .where((query) => query.where('requests.requester_id', userId).orWhere('requests.owner_id', userId))
    .select(
      'requests.request_id', 'requests.space_id', 'requests.requester_id', 'requests.owner_id',
      'requests.requested_from', 'requests.requested_to', 'requests.message', 'requests.status', 'requests.created_at',
      'spaces.title as space_title', 'requester.name as requester_name', 'owner.name as owner_name'
    )
    .orderBy('requests.created_at', 'desc')
    .limit(200);
}

async function updateSpaceRequest({ requestId, ownerId, status }) {
  if (!['accepted', 'declined'].includes(status)) throw rentalError('invalid_status');
  const [request] = await knex('space_rental_requests')
    .where({ request_id: requestId, owner_id: ownerId, status: 'pending' })
    .update({ status, updated_at: knex.fn.now() })
    .returning('*');
  if (!request) throw rentalError('request_not_found_or_not_pending', 404);
  return request;
}

module.exports = {
  createSpace,
  createSpaceRequest,
  ensureSpaceRentalSchema,
  listSpaceRequests,
  listOwnedSpaces,
  listSpaces,
  setSpaceStatus,
  updateSpaceRequest,
};
