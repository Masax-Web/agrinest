const crypto = require('crypto');
const { promisify } = require('util');
const knex = require('../db');
const { personas } = require('../../shared/personas.json');
const roleModel = require('../../shared/role-model.json');

const scryptAsync = promisify(crypto.scrypt);
const passwordKeyLength = 64;
const sessionLifetimeMs = 12 * 60 * 60 * 1000;
const recentAuthenticationWindowMs = 5 * 60 * 1000;
const adminImpersonationLifetimeMs = 15 * 60 * 1000;
const farmerProfileFields = new Set([
  'name', 'phone', 'phoneNumbers', 'primaryPhoneId', 'email', 'location', 'country', 'region',
  'city', 'district', 'ward', 'street', 'nidaLast4', 'farm', 'farmSize', 'crops', 'livestock',
  'landTenure', 'yearsFarming', 'cooperative', 'irrigation', 'certifications', 'latitude',
  'longitude', 'bankAccounts', 'avatar', 'coverPhoto', 'farmRecords',
]);
const personasById = new Map(personas.map((persona) => [persona.id, persona]));
const coreRoleIds = new Set(roleModel.coreRoles.map((coreRole) => coreRole.id));
const coreRoleByPersonaId = new Map(roleModel.coreRoles.flatMap((coreRole) => (
  coreRole.personas.map((personaId) => [personaId, coreRole.id])
)));
const defaultPersonaByCoreRole = new Map(roleModel.coreRoles.map((coreRole) => [coreRole.id, coreRole.defaultPersona]));
const legacyPersonaIds = {
  ...roleModel.legacyPersonaAliases,
  ...Object.fromEntries(roleModel.coreRoles.map((coreRole) => [coreRole.id, coreRole.defaultPersona])),
};

class AuthError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function fail(code, status) {
  throw new AuthError(code, status);
}

function normalizePersonaId(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return legacyPersonaIds[normalized] || normalized;
}

function getPersonaId(user) {
  return normalizePersonaId(user?.persona_id || user?.role);
}

function getCoreRole(user) {
  const personaId = getPersonaId(user);
  return coreRoleByPersonaId.get(personaId)
    || (coreRoleIds.has(user?.role) ? user.role : 'user');
}

function isSuperAdmin(user) {
  return getPersonaId(user) === 'super_admin';
}

function normalizePhone(value) {
  return String(value || '').trim().replace(/[^\d+]/g, '');
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function publicUser(user) {
  const personaId = getPersonaId(user);
  const coreRole = getCoreRole(user);
  return {
    user_id: user.user_id,
    name: user.name,
    email: user.email || null,
    phone: user.phone || null,
    avatar_url: user.avatar_url || null,
    role: coreRole,
    persona_id: personaId,
    role_status: user.role_status || 'active',
    region: user.region || null,
    trust_score: Number(user.trust_score || 0),
    pin_enabled: Boolean(user.pin_hash),
    password_enabled: Boolean(user.password_hash),
    is_admin: personaId === 'super_admin',
  };
}

async function hashCredential(value) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(value, salt, passwordKeyLength, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`;
}

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    fail('password_must_be_12_to_128_characters', 400);
  }
  return hashCredential(password);
}

async function hashPin(pin) {
  if (typeof pin !== 'string' || !/^\d{6,12}$/.test(pin)) fail('pin_must_be_6_to_12_digits', 400);
  return hashCredential(pin);
}

async function verifyPassword(password, passwordHash) {
  if (typeof password !== 'string' || typeof passwordHash !== 'string') return false;
  const [algorithm, cost, blockSize, parallelism, salt, expectedHex] = passwordHash.split('$');
  if (algorithm !== 'scrypt' || cost !== '16384' || blockSize !== '8' || parallelism !== '1' || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== passwordKeyLength) return false;
  const actual = await scryptAsync(password, salt, passwordKeyLength, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return crypto.timingSafeEqual(actual, expected);
}

function hasRecentAuthentication(authenticatedAt) {
  const timestamp = new Date(authenticatedAt).getTime();
  const age = Date.now() - timestamp;
  return Number.isFinite(timestamp) && age >= 0 && age <= recentAuthenticationWindowMs;
}

async function verifySecurityChange(user, currentPassword, authenticatedAt) {
  if (user.password_hash) {
    if (!await verifyPassword(currentPassword, user.password_hash)) fail('current_password_invalid', 401);
    return;
  }
  if (!hasRecentAuthentication(authenticatedAt)) fail('recent_google_signin_required', 401);
}

async function createSession(userId, database = knex, lifetimeMs = sessionLifetimeMs) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + lifetimeMs);
  await database('auth_sessions').insert({
    session_id: crypto.randomUUID(),
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expiresAt,
  });
  return { token, expires_at: expiresAt.toISOString() };
}

function loginLimitKey(identifier, ipAddress = 'unknown') {
  return hashToken(`${String(ipAddress).slice(0, 100)}:${identifier}`);
}

async function assertLoginNotLimited(keyHash) {
  const row = await knex('auth_login_limits').where({ key_hash: keyHash }).first();
  if (row?.locked_until && new Date(row.locked_until) > new Date()) {
    fail('too_many_attempts', 429);
  }
}

async function recordLoginFailure(keyHash) {
  await knex.raw(`
    INSERT INTO auth_login_limits (key_hash, attempt_count, window_started_at)
    VALUES (?, 1, now())
    ON CONFLICT (key_hash) DO UPDATE SET
      attempt_count = CASE
        WHEN auth_login_limits.window_started_at < now() - interval '15 minutes' THEN 1
        ELSE auth_login_limits.attempt_count + 1
      END,
      window_started_at = CASE
        WHEN auth_login_limits.window_started_at < now() - interval '15 minutes' THEN now()
        ELSE auth_login_limits.window_started_at
      END,
      locked_until = CASE
        WHEN auth_login_limits.window_started_at < now() - interval '15 minutes' THEN NULL
        WHEN auth_login_limits.attempt_count >= 9 THEN now() + interval '15 minutes'
        ELSE auth_login_limits.locked_until
      END
  `, [keyHash]);
}

async function clearLoginFailures(keyHash) {
  await knex('auth_login_limits').where({ key_hash: keyHash }).del();
}

async function makePinChallenge(user, database = knex, rememberMe = false) {
  const token = crypto.randomBytes(32).toString('base64url');
  await database('auth_challenges').insert({
    challenge_id: crypto.randomUUID(),
    token_hash: hashToken(token),
    user_id: user.user_id,
    remember_me: rememberMe,
    expires_at: new Date(Date.now() + 5 * 60 * 1000),
  });
  return { user: publicUser(user), pin_required: true, challenge_token: token, expires_in: 300 };
}

async function registerUser(input = {}) {
  const name = String(input.name || '').trim();
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  const personaId = normalizePersonaId(input.persona_id || input.role);
  const persona = personasById.get(personaId);
  const coreRole = coreRoleByPersonaId.get(personaId);

  if (name.length < 2 || name.length > 120) fail('name_must_be_2_to_120_characters', 400);
  if (!/^\+?[0-9]{9,15}$/.test(phone)) fail('valid_phone_required', 400);
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) fail('valid_email_required', 400);
  if (!persona) fail('unknown_persona', 400);
  if (!coreRole) fail('persona_core_role_unmapped', 500);
  if (input.core_role && input.core_role !== coreRole) fail('persona_core_role_mismatch', 400);
  if (persona.id === 'super_admin') fail('persona_not_available_for_registration', 403);
  const passwordHash = await hashPassword(input.password);

  return knex.transaction(async (transaction) => {
    const existingUser = await transaction('users').where({ phone }).first();
    if (existingUser) fail('account_already_exists', 409);
    if (email) {
      const existingEmail = await transaction('users').whereRaw('LOWER(email) = ?', [email]).first();
      if (existingEmail) fail('account_already_exists', 409);
    }

    let invitation = null;
    if (persona.registration === 'invite') {
      if (!input.invitation_token) fail('invitation_required_for_persona', 403);
      invitation = await transaction('auth_invitations')
        .where({ token_hash: hashToken(input.invitation_token), persona_id: persona.id })
        .whereNull('consumed_at')
        .andWhere('expires_at', '>', new Date())
        .forUpdate()
        .first();
      if (!invitation) fail('invalid_or_expired_invitation', 403);
    }

    const roleStatus = persona.registration === 'review' ? 'pending' : 'active';
    const [user] = await transaction('users').insert({
      phone,
      email,
      name,
      role: coreRole,
      persona_id: persona.id,
      role_status: roleStatus,
      password_hash: passwordHash,
      trust_score: 0,
    }).returning(['user_id', 'phone', 'email', 'name', 'role', 'persona_id', 'role_status', 'region', 'trust_score', 'password_hash']);

    if (invitation) {
      await transaction('auth_invitations').where({ token_hash: invitation.token_hash }).update({ consumed_at: new Date() });
    }
    if (roleStatus === 'pending') return { user: publicUser(user), status: 'pending_approval' };
    const session = await createSession(user.user_id, transaction);
    return { user: publicUser(user), status: 'active', ...session };
  });
}

async function loginUser({ identifier, phone, password, staff_access: staffAccess = false, remember_me: rememberMe = false } = {}, metadata = {}) {
  const loginId = String(identifier || phone || '').trim();
  if (!loginId || !password) fail('identifier_and_password_required', 400);
  const isEmail = loginId.includes('@');
  const normalizedId = isEmail ? normalizeEmail(loginId) : normalizePhone(loginId);
  const limitKey = loginLimitKey(normalizedId, metadata.ip);
  await assertLoginNotLimited(limitKey);
  const user = await knex('users').where((query) => {
    if (isEmail) query.whereRaw('LOWER(email) = ?', [normalizedId]);
    else query.where({ phone: normalizedId });
  }).first();

  if (!user || !await verifyPassword(password, user.password_hash)) {
    await recordLoginFailure(limitKey);
    fail('invalid_credentials', 401);
  }
  if (user.role_status && user.role_status !== 'active') fail('account_pending_approval', 403);
  if (staffAccess && personasById.get(getPersonaId(user))?.registration !== 'invite') fail('staff_account_required', 403);
  await clearLoginFailures(limitKey);
  if (user.pin_hash) return makePinChallenge(user, knex, rememberMe === true);
  const lifetime = rememberMe === true ? 30 * 24 * 60 * 60 * 1000 : sessionLifetimeMs;
  const session = await createSession(user.user_id, knex, lifetime);
  return { user: publicUser(user), ...session };
}

async function completePinChallenge({ challenge_token: challengeToken, pin } = {}, metadata = {}) {
  if (!challengeToken || typeof pin !== 'string' || !/^\d{6,12}$/.test(pin)) fail('invalid_pin_challenge', 400);
  const challengeHash = hashToken(challengeToken);
  const limitKey = loginLimitKey(challengeHash, metadata.ip);
  await assertLoginNotLimited(limitKey);

  const result = await knex.transaction(async (transaction) => {
    const challenge = await transaction('auth_challenges')
      .where({ token_hash: challengeHash })
      .whereNull('consumed_at')
      .andWhere('expires_at', '>', new Date())
      .forUpdate()
      .first();
    if (!challenge || challenge.attempt_count >= 5) fail('invalid_pin_challenge', 401);
    await transaction('auth_challenges').where({ challenge_id: challenge.challenge_id })
      .update({ attempt_count: challenge.attempt_count + 1 });
    const user = await transaction('users').where({ user_id: challenge.user_id }).first();
    if (!user || user.role_status !== 'active' || !await verifyPassword(pin, user.pin_hash)) {
      return { error: 'invalid_pin' };
    }
    await transaction('auth_challenges').where({ challenge_id: challenge.challenge_id })
      .update({ consumed_at: new Date() });
    const lifetime = challenge.remember_me ? 30 * 24 * 60 * 60 * 1000 : sessionLifetimeMs;
    const session = await createSession(user.user_id, transaction, lifetime);
    return { user: publicUser(user), ...session };
  });

  if (result.error) {
    await recordLoginFailure(limitKey);
    fail(result.error, 401);
  }
  await clearLoginFailures(limitKey);
  return result;
}

async function findOrCreateGoogleUser({ sub, email, name, picture, registration } = {}) {
  const verifiedEmail = normalizeEmail(email);
  if (!sub || !verifiedEmail) fail('google_identity_invalid', 401);
  const bootstrapEmail = normalizeEmail(process.env.ADMIN_BOOTSTRAP_EMAIL);
  const requestedPersonaId = normalizePersonaId(registration?.persona_id || 'smallholder_farmer');
  const requestedPersona = personasById.get(requestedPersonaId);
  if (!requestedPersona || requestedPersona.id === 'super_admin') fail('unknown_persona', 400);
  const requestedCoreRole = coreRoleByPersonaId.get(requestedPersonaId);
  if (!requestedCoreRole) fail('persona_core_role_unmapped', 500);
  if (registration?.core_role && registration.core_role !== requestedCoreRole) {
    fail('persona_core_role_mismatch', 400);
  }
  const requestedPhone = registration ? normalizePhone(registration.phone) : null;
  if (registration && !/^\+?[0-9]{9,15}$/.test(requestedPhone || '')) fail('valid_phone_required', 400);

  return knex.transaction(async (transaction) => {
    let user = await transaction('users').where({ google_subject: sub }).first();
    let createdForGoogleRegistration = false;
    if (user && normalizeEmail(user.email) !== verifiedEmail) fail('google_identity_mismatch', 403);
    if (!user) {
      user = await transaction('users').whereRaw('LOWER(email) = ?', [verifiedEmail]).forUpdate().first();
      if (user?.google_subject && user.google_subject !== sub) fail('google_identity_already_linked', 409);

      if (!user) {
        let role = coreRoleByPersonaId.get(requestedPersona.id);
        let personaId = requestedPersona.id;
        let roleStatus = requestedPersona.registration === 'review' ? 'pending' : 'active';
        let invitation = null;
        if (requestedPersona.registration === 'invite') {
          if (!registration?.invitation_token_hash) fail('invitation_required_for_persona', 403);
          invitation = await transaction('auth_invitations')
            .where({ token_hash: registration.invitation_token_hash, persona_id: requestedPersona.id })
            .whereNull('consumed_at')
            .andWhere('expires_at', '>', new Date())
            .forUpdate()
            .first();
          if (!invitation) fail('invalid_or_expired_invitation', 403);
        }
        if (bootstrapEmail === verifiedEmail) {
          const admin = await transaction('users').where({ role: 'admin', persona_id: 'super_admin' }).first();
          if (!admin) {
            role = 'admin';
            personaId = 'super_admin';
            roleStatus = 'active';
            invitation = null;
          }
        }
        if (requestedPhone) {
          const existingPhone = await transaction('users').where({ phone: requestedPhone }).first();
          if (existingPhone) fail('account_already_exists', 409);
        }
        const [created] = await transaction('users').insert({
          email: verifiedEmail,
          google_subject: sub,
          avatar_url: picture || null,
          name: String(name || verifiedEmail).slice(0, 120),
          phone: requestedPhone,
          role,
          persona_id: personaId,
          role_status: roleStatus,
          trust_score: 0,
        }).returning('*');
        user = created;
        createdForGoogleRegistration = true;
        if (invitation) {
          await transaction('auth_invitations')
            .where({ invitation_id: invitation.invitation_id })
            .update({ consumed_at: new Date() });
        }
      } else {
        await transaction('users').where({ user_id: user.user_id }).update({
          google_subject: sub,
          avatar_url: user.avatar_url || picture || null,
          name: user.name || String(name || verifiedEmail).slice(0, 120),
          updated_at: new Date(),
        });
        user.google_subject = sub;
        user.avatar_url = user.avatar_url || picture || null;
        if (!user.name) user.name = String(name || verifiedEmail).slice(0, 120);
      }
    }

    if (user.role_status !== 'active'
      && !(createdForGoogleRegistration && user.role_status === 'pending')) {
      fail('account_pending_approval', 403);
    }

    if (bootstrapEmail === verifiedEmail && !isSuperAdmin(user)) {
      const admin = await transaction('users').where({ role: 'admin', persona_id: 'super_admin' }).forUpdate().first();
      if (!admin) {
        await transaction('users').where({ user_id: user.user_id }).update({
          role: 'admin',
          persona_id: 'super_admin',
          updated_at: new Date(),
        });
        user.role = 'admin';
        user.persona_id = 'super_admin';
      }
    }
    return user;
  });
}

async function createGoogleExchangeCode(userId) {
  const code = crypto.randomBytes(32).toString('base64url');
  await knex('auth_exchange_codes').insert({
    code_hash: hashToken(code),
    user_id: userId,
    expires_at: new Date(Date.now() + 2 * 60 * 1000),
  });
  return code;
}

async function exchangeGoogleCode(code) {
  if (!code) fail('invalid_or_expired_google_code', 401);
  const codeHash = hashToken(code);
  return knex.transaction(async (transaction) => {
    const row = await transaction('auth_exchange_codes')
      .where({ code_hash: codeHash })
      .whereNull('consumed_at')
      .andWhere('expires_at', '>', new Date())
      .forUpdate()
      .first();
    if (!row) fail('invalid_or_expired_google_code', 401);
    await transaction('auth_exchange_codes').where({ code_hash: codeHash }).update({ consumed_at: new Date() });
    const user = await transaction('users').where({ user_id: row.user_id }).first();
    if (!user) fail('account_pending_approval', 403);
    if (user.role_status !== 'active') {
      return { user: publicUser(user), status: 'pending_approval' };
    }
    if (user.pin_hash) return makePinChallenge(user, transaction);
    return createSession(user.user_id, transaction).then((session) => ({ user: publicUser(user), ...session }));
  });
}

async function setPin({ userId, currentPassword, authenticatedAt, pin } = {}) {
  if (typeof pin !== 'string' || !/^\d{6,12}$/.test(pin)) fail('pin_must_be_6_to_12_digits', 400);
  const user = await knex('users').where({ user_id: userId }).first();
  if (!user) fail('account_not_found', 404);
  await verifySecurityChange(user, currentPassword, authenticatedAt);
  const pinHash = await hashPin(pin);
  await knex('users').where({ user_id: userId }).update({ pin_hash: pinHash, updated_at: new Date() });
  await knex('auth_challenges').where({ user_id: userId }).whereNull('consumed_at').update({ consumed_at: new Date() });
  return { pin_enabled: true };
}

async function removePin({ userId, currentPassword, authenticatedAt } = {}) {
  const user = await knex('users').where({ user_id: userId }).first();
  if (!user) fail('account_not_found', 404);
  await verifySecurityChange(user, currentPassword, authenticatedAt);
  await knex('users').where({ user_id: userId }).update({ pin_hash: null, updated_at: new Date() });
  await knex('auth_challenges').where({ user_id: userId }).whereNull('consumed_at').update({ consumed_at: new Date() });
  return { pin_enabled: false };
}

async function changePassword({ userId, currentPassword, newPassword } = {}) {
  const user = await knex('users').where({ user_id: userId }).first();
  if (!user || !user.password_hash || !await verifyPassword(currentPassword, user.password_hash)) {
    fail('current_password_invalid', 401);
  }
  const passwordHash = await hashPassword(newPassword);
  await knex.transaction(async (transaction) => {
    await transaction('users').where({ user_id: userId }).update({ password_hash: passwordHash, updated_at: new Date() });
    await transaction('auth_sessions').where({ user_id: userId }).whereNull('revoked_at')
      .update({ revoked_at: new Date() });
    await transaction('auth_challenges').where({ user_id: userId }).whereNull('consumed_at')
      .update({ consumed_at: new Date() });
  });
  return { success: true };
}

async function getSessionUser(token) {
  if (!token) return null;
  const row = await knex('auth_sessions as sessions')
    .join('users', 'users.user_id', 'sessions.user_id')
    .where('sessions.token_hash', hashToken(token))
    .whereNull('sessions.revoked_at')
    .andWhere('sessions.expires_at', '>', new Date())
    .select('users.user_id', 'users.name', 'users.email', 'users.phone', 'users.avatar_url', 'users.role', 'users.persona_id', 'users.role_status', 'users.region', 'users.trust_score', 'users.pin_hash', 'users.password_hash', 'sessions.session_id', 'sessions.created_at as session_created_at')
    .first();
  if (!row || (row.role_status && row.role_status !== 'active')) return null;
  return { user: publicUser(row), sessionCreatedAt: row.session_created_at, sessionId: row.session_id };
}

function sanitizeFarmerProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) fail('invalid_profile', 400);
  const sanitized = Object.fromEntries(
    Object.entries(profile).filter(([key]) => farmerProfileFields.has(key)),
  );
  delete sanitized.nidaNumber;
  if (Object.hasOwn(sanitized, 'farmRecords')) {
    const records = sanitized.farmRecords;
    const recordCollections = ['fields', 'listings', 'income', 'livestock', 'groups', 'activities', 'requests', 'payroll'];
    const optionalCollections = ['expenses', 'crowdfunding', 'carbon', 'sustainability', 'ndvi', 'irrigationLogs', 'irrigationSettings', 'moistureReadings'];
    if (!records || typeof records !== 'object' || Array.isArray(records)
      || recordCollections.some((collection) => !Array.isArray(records[collection])
        || records[collection].length > 5000
        || records[collection].some((record) => !record || typeof record !== 'object' || Array.isArray(record)))
      || optionalCollections.some((collection) => records[collection] !== undefined
        && (!Array.isArray(records[collection])
          || records[collection].length > 5000
          || records[collection].some((record) => !record || typeof record !== 'object' || Array.isArray(record))))) {
      fail('invalid_farm_records', 400);
    }
    sanitized.farmRecords = {
      ...records,
      expenses: records.expenses || [],
      crowdfunding: records.crowdfunding || [],
      carbon: records.carbon || [],
      sustainability: records.sustainability || [],
      ndvi: records.ndvi || [],
      irrigationLogs: records.irrigationLogs || [],
      irrigationSettings: records.irrigationSettings || [],
      moistureReadings: records.moistureReadings || [],
    };
    sanitized.farmRecords.fields = sanitized.farmRecords.fields.map(sanitizeGeotaggedFarmRecord);
    sanitized.farmRecords.activities = sanitized.farmRecords.activities.map(sanitizeGeotaggedFarmRecord);
    sanitized.farmRecords.livestock = sanitized.farmRecords.livestock.map(sanitizeGeotaggedFarmRecord);
  }
  for (const field of ['avatar', 'coverPhoto']) {
    const image = sanitized[field];
    if (image && (typeof image !== 'string'
      || image.length > 5_000_000
      || !/^(https:\/\/|data:image\/(?:jpeg|png|webp);base64,)/i.test(image))) {
      fail('invalid_profile_image', 400);
    }
  }
  if (Buffer.byteLength(JSON.stringify(sanitized), 'utf8') > 8_000_000) fail('profile_too_large', 413);
  return sanitized;
}

function sanitizeGeotaggedFarmRecord(record) {
  if (record.evidenceKind !== 'geotagged') return record;
  const gps = record.gpsStamp;
  if (!gps || typeof gps !== 'object' || Array.isArray(gps)) fail('geotagged_location_required', 400);
  const latitude = Number(gps.latitude);
  const longitude = Number(gps.longitude);
  const accuracy = Number(gps.accuracy);
  const gpsTime = Date.parse(gps.stampedAt);
  const photoTime = Date.parse(record.photoAddedAt);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
    || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 50
    || !Number.isFinite(gpsTime)
    || !Number.isFinite(photoTime)
    || Math.abs(gpsTime - photoTime) > 15 * 60 * 1000) {
    fail('invalid_geotagged_location', 400);
  }
  if (typeof record.farmerId !== 'string' || typeof record.farmId !== 'string'
    || typeof record.photo !== 'string'
    || record.photo.length > 700_000
    || !/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]*={0,2}$/i.test(record.photo)) {
    fail('geotagged_photo_required', 400);
  }
  const encoded = record.photo.slice(record.photo.indexOf(',') + 1);
  const image = Buffer.from(encoded, 'base64');
  if (!image.length || image.length > 550_000) fail('geotagged_photo_too_large', 400);
  return {
    ...record,
    photoSha256: crypto.createHash('sha256').update(image).digest('hex'),
  };
}

async function getFarmerProfile(userId) {
  const [user, profileRow] = await Promise.all([
    knex('users').select('avatar_url').where({ user_id: userId }).first(),
    knex('farmer_profiles').select('profile', 'updated_at').where({ user_id: userId }).first(),
  ]);
  if (!user) fail('account_not_found', 404);
  const profile = profileRow?.profile || {};
  return {
    profile: { ...profile, avatar: profile.avatar || user.avatar_url || '' },
    has_saved_profile: Boolean(profileRow),
    updated_at: profileRow?.updated_at || null,
  };
}

async function saveFarmerProfile(userId, profile) {
  const sanitized = sanitizeFarmerProfile(profile);
  const geotaggedRecords = [
    ...sanitized.farmRecords.fields,
    ...sanitized.farmRecords.activities,
    ...sanitized.farmRecords.livestock,
  ].filter((record) => record.evidenceKind === 'geotagged');
  if (geotaggedRecords.some((record) => record.farmerId !== userId)) fail('farm_record_farmer_id_mismatch', 403);
  const linkedFarmIds = [...new Set(geotaggedRecords.map((record) => record.farmId))];
  if (linkedFarmIds.length) {
    const accessibleFarms = await knex('farms')
      .leftJoin('farm_members', function joinMembers() {
        this.on('farm_members.farm_id', '=', 'farms.farm_id')
          .andOn('farm_members.user_id', '=', knex.raw('?', [userId]));
      })
      .whereIn('farms.farm_id', linkedFarmIds)
      .andWhere(function matchFarmAccess() {
        this.where('farms.user_id', userId)
          .orWhere(function activeMembership() {
            this.where('farm_members.user_id', userId).andWhere('farm_members.status', 'active');
          });
      })
      .distinct('farms.farm_id');
    const authorizedFarmIds = new Set(accessibleFarms.map((farm) => farm.farm_id));
    if (linkedFarmIds.some((farmId) => !authorizedFarmIds.has(farmId))) fail('farm_record_farm_id_mismatch', 403);
  }
  await knex.transaction(async (transaction) => {
    await transaction('farmer_profiles')
      .insert({ user_id: userId, profile: sanitized, updated_at: new Date() })
      .onConflict('user_id')
      .merge({ profile: sanitized, updated_at: new Date() });
    const userUpdates = { updated_at: new Date() };
    if (typeof sanitized.name === 'string') userUpdates.name = sanitized.name.trim().slice(0, 120);
    if (typeof sanitized.region === 'string') userUpdates.region = sanitized.region.trim().slice(0, 120);
    if (Object.hasOwn(sanitized, 'avatar')) userUpdates.avatar_url = sanitized.avatar || null;
    await transaction('users').where({ user_id: userId }).update(userUpdates);
  });
  return getFarmerProfile(userId);
}

async function startAdminImpersonation({ actorId, actorSessionId, targetId } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + adminImpersonationLifetimeMs);
  return knex.transaction(async (transaction) => {
    const actor = await transaction('users').where({ user_id: actorId }).forUpdate().first();
    if (!actor || !isSuperAdmin(actor) || actor.role_status !== 'active') {
      fail('admin_access_required', 403);
    }
    if (actorId === targetId) fail('cannot_impersonate_self', 400);
    const actorSession = await transaction('auth_sessions')
      .where({ session_id: actorSessionId, user_id: actorId })
      .whereNull('revoked_at')
      .andWhere('expires_at', '>', new Date())
      .forUpdate()
      .first();
    if (!actorSession) fail('session_invalid_or_expired', 401);

    const target = await transaction('users').where({ user_id: targetId }).forUpdate().first();
    if (!target || target.role_status !== 'active' || isSuperAdmin(target)) {
      fail('impersonation_target_unavailable', 404);
    }

    await transaction('auth_admin_impersonation_sessions').insert({
      session_id: sessionId,
      token_hash: hashToken(token),
      actor_user_id: actorId,
      actor_session_id: actorSessionId,
      target_user_id: targetId,
      expires_at: expiresAt,
    });
    await transaction('auth_audit_log').insert({
      audit_id: crypto.randomUUID(),
      actor_user_id: actorId,
      target_user_id: targetId,
      action: 'admin.impersonation_started',
      details: { session_id: sessionId, target_role: getPersonaId(target), expires_at: expiresAt.toISOString() },
    });
    return { token, sessionId, expiresAt: expiresAt.toISOString(), user: publicUser(target), admin: publicUser(actor) };
  });
}

async function getAdminImpersonation(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  return knex.transaction(async (transaction) => {
    const row = await transaction('auth_admin_impersonation_sessions as impersonations')
      .join('users as actors', 'actors.user_id', 'impersonations.actor_user_id')
      .join('users as targets', 'targets.user_id', 'impersonations.target_user_id')
      .join('auth_sessions as admin_sessions', 'admin_sessions.session_id', 'impersonations.actor_session_id')
      .where('impersonations.token_hash', tokenHash)
      .whereNull('impersonations.ended_at')
      .forUpdate()
      .select(
        'impersonations.session_id',
        'impersonations.actor_user_id',
        'impersonations.target_user_id',
        'impersonations.expires_at',
        'admin_sessions.revoked_at as actor_session_revoked_at',
        'admin_sessions.expires_at as actor_session_expires_at',
        'actors.name as actor_name',
        'actors.email as actor_email',
        'actors.phone as actor_phone',
        'actors.role as actor_role',
        'actors.persona_id as actor_persona_id',
        'actors.region as actor_region',
        'actors.trust_score as actor_trust_score',
        'actors.pin_hash as actor_pin_hash',
        'actors.password_hash as actor_password_hash',
        'actors.role_status as actor_status',
        'targets.user_id',
        'targets.name',
        'targets.email',
        'targets.phone',
        'targets.role',
        'targets.persona_id',
        'targets.role_status',
        'targets.region',
        'targets.trust_score',
        'targets.pin_hash',
        'targets.password_hash',
      )
      .first();
    if (!row) return null;

    const expired = new Date(row.expires_at) <= new Date();
    const actorUnavailable = getPersonaId({ role: row.actor_role, persona_id: row.actor_persona_id }) !== 'super_admin'
      || row.actor_status !== 'active'
      || row.actor_session_revoked_at
      || new Date(row.actor_session_expires_at) <= new Date();
    const targetUnavailable = row.role_status !== 'active' || isSuperAdmin({ role: row.role, persona_id: row.persona_id });
    if (expired || actorUnavailable || targetUnavailable) {
      const endReason = expired ? 'expired'
        : actorUnavailable ? 'administrator_session_unavailable'
          : 'target_unavailable';
      await transaction('auth_admin_impersonation_sessions')
        .where({ session_id: row.session_id })
        .whereNull('ended_at')
        .update({ ended_at: new Date(), end_reason: endReason });
      await transaction('auth_audit_log').insert({
        audit_id: crypto.randomUUID(),
        actor_user_id: row.actor_user_id,
        target_user_id: row.target_user_id,
        action: 'admin.impersonation_ended',
        details: { session_id: row.session_id, reason: endReason },
      });
      return null;
    }

    const { user_id: _userId, name, email, phone, role, persona_id: personaId, role_status: roleStatus, region, trust_score: trustScore, pin_hash: pinHash, password_hash: passwordHash } = row;
    return {
      user: publicUser({ user_id: row.user_id, name, email, phone, role, persona_id: personaId, role_status: roleStatus, region, trust_score: trustScore, pin_hash: pinHash, password_hash: passwordHash }),
      actor: publicUser({
        user_id: row.actor_user_id,
        name: row.actor_name,
        email: row.actor_email,
        phone: row.actor_phone,
        role: row.actor_role,
        persona_id: row.actor_persona_id,
        role_status: row.actor_status,
        region: row.actor_region,
        trust_score: row.actor_trust_score,
        pin_hash: row.actor_pin_hash,
        password_hash: row.actor_password_hash,
      }),
      sessionId: row.session_id,
      expiresAt: new Date(row.expires_at).toISOString(),
    };
  });
}

async function endAdminImpersonation({ token, actorId, reason = 'administrator_returned' } = {}) {
  if (!token || !actorId) return false;
  const tokenHash = hashToken(token);
  return knex.transaction(async (transaction) => {
    const session = await transaction('auth_admin_impersonation_sessions')
      .where({ token_hash: tokenHash, actor_user_id: actorId })
      .whereNull('ended_at')
      .forUpdate()
      .first();
    if (!session) return false;
    await transaction('auth_admin_impersonation_sessions')
      .where({ session_id: session.session_id })
      .update({ ended_at: new Date(), end_reason: reason });
    await transaction('auth_audit_log').insert({
      audit_id: crypto.randomUUID(),
      actor_user_id: actorId,
      target_user_id: session.target_user_id,
      action: 'admin.impersonation_ended',
      details: { session_id: session.session_id, reason },
    });
    return true;
  });
}

async function revokeSession(token) {
  if (!token) return false;
  const affected = await knex('auth_sessions').where({ token_hash: hashToken(token) }).whereNull('revoked_at').update({ revoked_at: new Date() });
  return affected > 0;
}

async function createInvitation({ personaId, createdBy, expiresInDays = 7 }) {
  const persona = personasById.get(normalizePersonaId(personaId));
  if (!persona || persona.registration !== 'invite' || persona.id === 'super_admin') {
    fail('persona_does_not_use_invitations', 400);
  }
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + Math.max(1, Math.min(Number(expiresInDays) || 7, 30)) * 24 * 60 * 60 * 1000);
  await knex('auth_invitations').insert({
    invitation_id: crypto.randomUUID(),
    token_hash: hashToken(token),
    persona_id: persona.id,
    created_by: createdBy,
    expires_at: expiresAt,
  });
  return { token, persona_id: persona.id, expires_at: expiresAt.toISOString() };
}

async function approvePersona(userId) {
  const [user] = await knex('users')
    .where({ user_id: userId, role_status: 'pending' })
    .where((query) => query.whereNot('role', 'admin').orWhereNot('persona_id', 'super_admin'))
    .update({ role_status: 'active', approved_at: new Date(), updated_at: new Date() })
    .returning(['user_id', 'phone', 'email', 'name', 'role', 'persona_id', 'role_status', 'region', 'trust_score', 'password_hash']);
  if (!user) fail('pending_account_not_found', 404);
  return publicUser(user);
}

async function listAdminUsers({ query = '', status = '' } = {}) {
  const usersQuery = knex('users').select('user_id', 'name', 'email', 'phone', 'role', 'persona_id', 'role_status', 'created_at', 'pin_hash', 'password_hash');
  if (status) usersQuery.where({ role_status: status });
  if (query.trim()) {
    const search = `%${query.trim().slice(0, 100)}%`;
    usersQuery.where((builder) => builder.whereILike('name', search)
      .orWhereILike('email', search).orWhereILike('phone', search));
  }
  const users = await usersQuery.orderBy('created_at', 'desc').limit(200);
  return users.map(publicUser);
}

async function recordAdminAction({ actorId, targetId = null, action, details = {} }) {
  await knex('auth_audit_log').insert({
    audit_id: crypto.randomUUID(),
    actor_user_id: actorId,
    target_user_id: targetId,
    action,
    details,
  });
}

async function setUserStatus({ actorId, userId, status }) {
  if (!['active', 'suspended'].includes(status)) fail('invalid_account_status', 400);
  if (actorId === userId) fail('cannot_change_own_account_status', 400);
  const user = await knex('users').where({ user_id: userId }).first();
  if (!user || isSuperAdmin(user)) fail('user_not_found_or_protected', 404);
  await knex.transaction(async (transaction) => {
    await transaction('users').where({ user_id: userId }).update({ role_status: status, updated_at: new Date() });
    if (status === 'suspended') {
      await transaction('auth_sessions').where({ user_id: userId }).whereNull('revoked_at')
        .update({ revoked_at: new Date() });
      await transaction('auth_challenges').where({ user_id: userId }).whereNull('consumed_at')
        .update({ consumed_at: new Date() });
    }
    await transaction('auth_audit_log').insert({
      audit_id: crypto.randomUUID(), actor_user_id: actorId, target_user_id: userId,
      action: `user.${status}`, details: {},
    });
  });
  return { user_id: userId, role_status: status };
}

async function setUserPersona({ actorId, userId, personaId }) {
  const persona = personasById.get(normalizePersonaId(personaId));
  if (!persona || persona.id === 'super_admin') fail('invalid_persona_assignment', 400);
  const user = await knex('users').where({ user_id: userId }).first();
  if (!user || isSuperAdmin(user)) fail('user_not_found_or_protected', 404);
  await knex.transaction(async (transaction) => {
    await transaction('users').where({ user_id: userId }).update({
      role: coreRoleByPersonaId.get(persona.id),
      persona_id: persona.id,
      updated_at: new Date(),
    });
    await transaction('auth_audit_log').insert({
      audit_id: crypto.randomUUID(), actor_user_id: actorId, target_user_id: userId,
      action: 'user.persona_changed', details: { persona_id: persona.id },
    });
  });
  return { user_id: userId, role: coreRoleByPersonaId.get(persona.id), persona_id: persona.id };
}

async function setFarmerPersona({ userId, personaId }) {
  const persona = personasById.get(normalizePersonaId(personaId));
  if (!persona || coreRoleByPersonaId.get(persona.id) !== 'farmer') fail('farmer_persona_required', 400);
  if (persona.registration !== 'self') fail('farmer_persona_requires_review', 403);
  const user = await knex('users').where({ user_id: userId }).first();
  if (!user || getCoreRole(user) !== 'farmer') fail('farmer_account_required', 403);
  await knex.transaction(async (transaction) => {
    await transaction('users').where({ user_id: userId }).update({ persona_id: persona.id, updated_at: new Date() });
    await transaction('auth_audit_log').insert({
      audit_id: crypto.randomUUID(),
      actor_user_id: userId,
      target_user_id: userId,
      action: 'user.farmer_persona_changed',
      details: { persona_id: persona.id },
    });
  });
  return publicUser({ ...user, persona_id: persona.id });
}

async function listAdminAuditLog(limit = 100) {
  return knex('auth_audit_log as audit')
    .leftJoin('users as actors', 'actors.user_id', 'audit.actor_user_id')
    .leftJoin('users as targets', 'targets.user_id', 'audit.target_user_id')
    .select('audit.audit_id', 'audit.action', 'audit.details', 'audit.created_at',
      'actors.email as actor_email', 'targets.email as target_email')
    .orderBy('audit.created_at', 'desc')
    .limit(Math.max(1, Math.min(Number(limit) || 100, 200)));
}

async function bootstrapSuperAdmin({ name, phone, email, password }) {
  const normalizedPhone = normalizePhone(phone);
  if (!name || !/^\+?[0-9]{9,15}$/.test(normalizedPhone)) fail('bootstrap_name_and_phone_required', 400);
  const passwordHash = await hashPassword(password);
  const existingAdmin = await knex('users').where({ role: 'admin', persona_id: 'super_admin' }).first();
  if (existingAdmin) fail('super_admin_already_exists', 409);
  const [user] = await knex('users').insert({
    name: String(name).trim(),
    phone: normalizedPhone,
    email: normalizeEmail(email),
    role: 'admin',
    persona_id: 'super_admin',
    role_status: 'active',
    password_hash: passwordHash,
    trust_score: 0,
  }).returning(['user_id', 'phone', 'email', 'name', 'role', 'persona_id', 'role_status', 'region', 'trust_score', 'password_hash']);
  return publicUser(user);
}

module.exports = {
  AuthError,
  approvePersona,
  bootstrapSuperAdmin,
  changePassword,
  completePinChallenge,
  createInvitation,
  createGoogleExchangeCode,
  exchangeGoogleCode,
  endAdminImpersonation,
  findOrCreateGoogleUser,
  getFarmerProfile,
  getAdminImpersonation,
  getSessionUser,
  hashPassword,
  listAdminAuditLog,
  listAdminUsers,
  loginUser,
  makePinChallenge,
  normalizePersonaId,
  personas,
  publicUser,
  recordAdminAction,
  registerUser,
  removePin,
  revokeSession,
  saveFarmerProfile,
  setPin,
  setFarmerPersona,
  startAdminImpersonation,
  setUserPersona,
  setUserStatus,
  verifyPassword,
};