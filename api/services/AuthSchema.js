const { personas } = require('../../shared/personas.json');
const roleModel = require('../../shared/role-model.json');

const personaById = new Map(personas.map((persona) => [persona.id, persona]));
const coreRoleByPersona = new Map(roleModel.coreRoles.flatMap((coreRole) => (
  coreRole.personas.map((personaId) => [personaId, coreRole.id])
)));
const defaultPersonaByCoreRole = new Map(roleModel.coreRoles.map((coreRole) => [coreRole.id, coreRole.defaultPersona]));
const personaAliases = roleModel.legacyPersonaAliases;

function resolveRoleIdentity(role, existingPersonaId = null) {
  const roleValue = String(role || 'community_member').trim().toLowerCase();
  const personaId = existingPersonaId
    || personaAliases[roleValue]
    || (personaById.has(roleValue) ? roleValue : defaultPersonaByCoreRole.get(roleValue));
  const coreRole = coreRoleByPersona.get(personaId)
    || (!existingPersonaId && personaId === defaultPersonaByCoreRole.get(roleValue) ? roleValue : null);
  if (!personaId || !coreRole) {
    throw new Error(`Cannot migrate account with unrecognized role "${roleValue}".`);
  }
  return { role: coreRole, persona_id: personaId };
}

async function ensureAuthSchema(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await knex.raw(`CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(32) NOT NULL UNIQUE,
    name TEXT,
    nida_number TEXT,
    role TEXT,
    trust_score NUMERIC DEFAULT 0,
    region TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT');
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT');
  await knex.raw('ALTER TABLE users ALTER COLUMN phone DROP NOT NULL');
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS google_subject TEXT');
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT');
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT');
  await knex.raw("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_status TEXT NOT NULL DEFAULT 'active'");
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS persona_id TEXT');
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ');
  await knex.raw('ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ');
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email)) WHERE email IS NOT NULL');
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS users_google_subject_idx ON users (google_subject) WHERE google_subject IS NOT NULL');
  await knex.raw(`CREATE TABLE IF NOT EXISTS farmer_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_sessions (
    session_id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
  )`);
  await knex.raw('ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()');
  await knex.raw('ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ');
  await knex.raw('CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id, expires_at)');
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_challenges (
    challenge_id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    remember_me BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
  )`);
  await knex.raw('ALTER TABLE auth_challenges ADD COLUMN IF NOT EXISTS remember_me BOOLEAN NOT NULL DEFAULT false');
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_oauth_states (
    state_hash TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    registration_intent JSONB NOT NULL DEFAULT '{}'::jsonb
  )`);
  await knex.raw("ALTER TABLE auth_oauth_states ADD COLUMN IF NOT EXISTS registration_intent JSONB NOT NULL DEFAULT '{}'::jsonb");
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_exchange_codes (
    code_hash TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
  )`);
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_admin_impersonation_sessions (
    session_id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    actor_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    actor_session_id UUID NOT NULL REFERENCES auth_sessions(session_id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    end_reason TEXT
  )`);
  await knex.raw('CREATE INDEX IF NOT EXISTS auth_admin_impersonation_actor_idx ON auth_admin_impersonation_sessions (actor_user_id, expires_at)');
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_login_limits (
    key_hash TEXT PRIMARY KEY,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_until TIMESTAMPTZ
  )`);
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_invitations (
    invitation_id UUID PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    persona_id TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
  )`);
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_audit_log (
    audit_id UUID PRIMARY KEY,
    actor_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await knex.raw('CREATE INDEX IF NOT EXISTS auth_audit_log_created_idx ON auth_audit_log (created_at DESC)');
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_integration_settings (
    integration_id TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await knex.raw(`CREATE TABLE IF NOT EXISTS auth_schema_migrations (
    migration_id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await knex.transaction(async (transaction) => {
    const [roleMigration] = await transaction('auth_schema_migrations')
      .insert({ migration_id: 'core_role_persona_v1' })
      .onConflict('migration_id')
      .ignore()
      .returning('migration_id');
    if (roleMigration) {
      const users = await transaction('users').select('user_id', 'role', 'persona_id');
      for (const user of users) {
        const identity = resolveRoleIdentity(user.role, user.persona_id);
        await transaction('users').where({ user_id: user.user_id }).update(identity);
      }
    }
    const [sessionMigration] = await transaction('auth_schema_migrations')
      .insert({ migration_id: 'revoke_legacy_sessions_v1' })
      .onConflict('migration_id')
      .ignore()
      .returning('migration_id');
    if (sessionMigration) {
      await transaction('auth_sessions').whereNull('revoked_at').update({ revoked_at: new Date() });
    }
  });
}

module.exports = { ensureAuthSchema, resolveRoleIdentity };