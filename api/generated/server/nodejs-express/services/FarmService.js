const crypto = require('crypto');
const knex = require('../../../../db');

function farmError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function distanceBetweenCoordinates(left, right) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function normalizeLocation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw farmError('farm_location_required');
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const accuracy = Number(value.accuracy_m);
  const capturedAt = Date.parse(value.captured_at);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw farmError('invalid_farm_location');
  }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50) throw farmError('farm_location_accuracy_too_low');
  if (!Number.isFinite(capturedAt) || Math.abs(Date.now() - capturedAt) > 15 * 60 * 1000) {
    throw farmError('farm_location_stamp_expired');
  }
  return { latitude, longitude, accuracy_m: accuracy, captured_at: new Date(capturedAt).toISOString() };
}

function normalizeLocationEvidence(value, location) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw farmError('farm_location_photo_required');
  const { name, mime_type: mimeType, data_url: dataUrl } = value;
  const capturedAt = Date.parse(value.captured_at);
  if (typeof name !== 'string' || !name.trim() || name.length > 160
    || !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
    || typeof dataUrl !== 'string'
    || dataUrl.length > 1500000
    || !dataUrl.startsWith(`data:${mimeType};base64,`)
    || !Number.isFinite(capturedAt)
    || Math.abs(capturedAt - Date.parse(location.captured_at)) > 15 * 60 * 1000) {
    throw farmError('invalid_farm_location_photo');
  }
  const encoded = dataUrl.slice(dataUrl.indexOf(',') + 1);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw farmError('invalid_farm_location_photo');
  const bytes = Buffer.from(encoded, 'base64');
  if (!bytes.length || bytes.length > 1000000) throw farmError('farm_location_photo_too_large');
  return {
    name: name.trim(),
    mime_type: mimeType,
    data_url: dataUrl,
    captured_at: new Date(capturedAt).toISOString(),
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

async function createFarm(data) {
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 120) {
    throw farmError('invalid_farm_name');
  }
  const location = normalizeLocation(data.location);
  const evidence = normalizeLocationEvidence(data.location_evidence, location);
  return knex.transaction(async (transaction) => {
    await transaction.raw('SELECT pg_advisory_xact_lock(?)', [791246381]);
    const existing = await transaction('farms')
      .whereNotNull('location_latitude')
      .whereNotNull('location_longitude')
      .select('farm_id', 'user_id', 'location_latitude', 'location_longitude');
    const nearbyFarms = existing
      .map((farm) => ({
        farm_id: farm.farm_id,
        farmer_id: farm.user_id,
        distance_m: distanceBetweenCoordinates(location, {
          latitude: Number(farm.location_latitude),
          longitude: Number(farm.location_longitude),
        }),
      }))
      .filter((farm) => farm.distance_m <= 50);

    const [farm] = await transaction('farms').insert({
      user_id: data.user_id,
      name: data.name.trim(),
      soil_type: data.soil_type || null,
      total_acres: data.total_acres || null,
      farm_boundary: data.farm_boundary ? JSON.stringify(data.farm_boundary) : null,
      location_latitude: location.latitude,
      location_longitude: location.longitude,
      location_accuracy_m: location.accuracy_m,
      location_captured_at: location.captured_at,
      location_evidence: JSON.stringify(evidence),
      location_review_status: nearbyFarms.length ? 'review_required' : 'clear',
    }).returning([
      'farm_id',
      'user_id',
      'name',
      'soil_type',
      'total_acres',
      'location_latitude',
      'location_longitude',
      'location_accuracy_m',
      'location_captured_at',
      'location_review_status',
      'created_at',
    ]);

    await transaction('farm_operation_audit').insert({
      farm_id: farm.farm_id,
      actor_id: data.user_id,
      action: 'farm_created',
      target_type: 'farm',
      target_id: farm.farm_id,
      metadata: {
        location_accuracy_m: location.accuracy_m,
        location_evidence_sha256: evidence.sha256,
        proximity_review_required: nearbyFarms.length > 0,
      },
    });

    if (nearbyFarms.length) {
      await transaction('farm_location_reviews').insert(nearbyFarms.map((nearbyFarm) => ({
        new_farm_id: farm.farm_id,
        nearby_farm_id: nearbyFarm.farm_id,
        distance_m: nearbyFarm.distance_m,
      })));
    }

    return {
      ...farm,
      has_location_evidence: true,
      location_evidence_sha256: evidence.sha256,
      nearby_farms: nearbyFarms.map((nearbyFarm) => ({
        farm_id: nearbyFarm.farm_id,
        farmer_id: nearbyFarm.farmer_id,
        distance_m: Math.round(nearbyFarm.distance_m * 10) / 10,
      })),
    };
  });
}

async function getFarmById(farmId, userId) {
  const farm = await knex('farms')
    .where({ farm_id: farmId, user_id: userId })
    .select(
      'farm_id',
      'user_id',
      'name',
      'soil_type',
      'total_acres',
      'farm_boundary',
      'location_latitude',
      'location_longitude',
      'location_accuracy_m',
      'location_captured_at',
      'location_review_status',
      'created_at',
    )
    .first();
  return farm || null;
}

async function listFarmerLocationAlerts(userId) {
  return knex('farm_location_reviews as reviews')
    .join('farms as new_farms', 'new_farms.farm_id', 'reviews.new_farm_id')
    .join('farms as nearby_farms', 'nearby_farms.farm_id', 'reviews.nearby_farm_id')
    .where(function matchFarmOwners() {
      this.where('new_farms.user_id', userId).orWhere('nearby_farms.user_id', userId);
    })
    .select(
      'reviews.review_id',
      'reviews.new_farm_id',
      'new_farms.user_id as new_farmer_id',
      'reviews.nearby_farm_id',
      'nearby_farms.user_id as nearby_farmer_id',
      'reviews.distance_m',
      'reviews.status',
      'reviews.created_at',
    )
    .orderBy('reviews.created_at', 'desc')
    .limit(100);
}

async function listLocationReviews() {
  return knex('farm_location_reviews as reviews')
    .join('farms as new_farms', 'new_farms.farm_id', 'reviews.new_farm_id')
    .join('farms as nearby_farms', 'nearby_farms.farm_id', 'reviews.nearby_farm_id')
    .select(
      'reviews.review_id',
      'reviews.new_farm_id',
      'new_farms.user_id as new_farmer_id',
      'reviews.nearby_farm_id',
      'nearby_farms.user_id as nearby_farmer_id',
      'reviews.distance_m',
      'reviews.status',
      'reviews.created_at',
      'reviews.reviewed_at',
    )
    .orderBy('reviews.created_at', 'desc')
    .limit(500);
}

async function resolveLocationReview(reviewId, reviewerId, status) {
  if (!['reviewed', 'dismissed'].includes(status)) throw farmError('invalid_review_status');
  const [review] = await knex('farm_location_reviews')
    .where({ review_id: reviewId, status: 'pending' })
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date() })
    .returning(['review_id', 'new_farm_id', 'nearby_farm_id', 'status', 'reviewed_at']);
  if (!review) throw farmError('farm_location_review_not_found', 404);
  const pending = await knex('farm_location_reviews')
    .where({ new_farm_id: review.new_farm_id, status: 'pending' })
    .first();
  await knex('farms').where({ farm_id: review.new_farm_id }).update({
    location_review_status: pending ? 'review_required' : status,
  });
  return review;
}

module.exports = {
  createFarm,
  distanceBetweenCoordinates,
  getFarmById,
  listFarmerLocationAlerts,
  listLocationReviews,
  normalizeLocation,
  normalizeLocationEvidence,
  resolveLocationReview,
};
