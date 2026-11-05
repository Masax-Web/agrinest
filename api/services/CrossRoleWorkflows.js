const knex = require('../db');

function workflowError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw workflowError(`invalid_${field}`);
  }
  return value.trim();
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > maxLength) throw workflowError(`invalid_${field}`);
  return value.trim();
}

function boundedNumber(value, field, { minimum = 0, maximum = 1000000000, integer = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum || (integer && !Number.isInteger(number))) {
    throw workflowError(`invalid_${field}`);
  }
  return number;
}

function validDate(value, field, { allowPast = false } = {}) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw workflowError(`invalid_${field}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    || (!allowPast && value < new Date().toISOString().slice(0, 10))) {
    throw workflowError(`invalid_${field}`);
  }
  return value;
}

function requireRole(user, roles) {
  if (!roles.includes(user?.role)) throw workflowError('role_not_authorized', 403);
}

async function ensureCrossRoleWorkflowSchema(database) {
  await database.raw(`CREATE TABLE IF NOT EXISTS farms (
    farm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    soil_type TEXT,
    total_acres NUMERIC(14, 2),
    farm_boundary JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS farms_user_created_at_idx ON farms (user_id, created_at DESC)');
  await database.raw('ALTER TABLE farms ADD COLUMN IF NOT EXISTS location_latitude DOUBLE PRECISION');
  await database.raw('ALTER TABLE farms ADD COLUMN IF NOT EXISTS location_longitude DOUBLE PRECISION');
  await database.raw('ALTER TABLE farms ADD COLUMN IF NOT EXISTS location_accuracy_m DOUBLE PRECISION');
  await database.raw('ALTER TABLE farms ADD COLUMN IF NOT EXISTS location_captured_at TIMESTAMPTZ');
  await database.raw('ALTER TABLE farms ADD COLUMN IF NOT EXISTS location_evidence JSONB');
  await database.raw('ALTER TABLE farms ADD COLUMN IF NOT EXISTS location_review_status TEXT NOT NULL DEFAULT \'clear\'');
  await database.raw(`CREATE TABLE IF NOT EXISTS farm_location_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    new_farm_id UUID NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    nearby_farm_id UUID NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    distance_m DOUBLE PRECISION NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (new_farm_id, nearby_farm_id)
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS farm_location_reviews_status_created_idx ON farm_location_reviews (status, created_at DESC)');
  await database.raw(`CREATE TABLE IF NOT EXISTS farm_members (
    membership_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('manager', 'worker', 'adviser')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'declined')),
    invited_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (farm_id, user_id)
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS farm_members_user_status_idx ON farm_members (user_id, status)');
  await database.raw(`CREATE TABLE IF NOT EXISTS farm_tasks (
    task_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    assigned_to UUID REFERENCES users(user_id) ON DELETE SET NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS farm_tasks_farm_status_idx ON farm_tasks (farm_id, status, due_date)');
  await database.raw(`CREATE TABLE IF NOT EXISTS farm_resource_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    quantity NUMERIC(14, 2),
    estimated_cost NUMERIC(14, 2),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'fulfilled')),
    requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS farm_resource_requests_farm_status_idx ON farm_resource_requests (farm_id, status, created_at DESC)');
  await database.raw(`CREATE TABLE IF NOT EXISTS farm_operation_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS farm_operation_audit_farm_created_idx ON farm_operation_audit (farm_id, created_at DESC)');
  await database.raw(`CREATE TABLE IF NOT EXISTS farm_season_budgets (
    budget_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(farm_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    crop TEXT NOT NULL,
    field_id TEXT NOT NULL DEFAULT '',
    area_acres NUMERIC(14, 2),
    expected_yield_kg NUMERIC(14, 2),
    target_price_per_kg NUMERIC(14, 2),
    planned_costs JSONB NOT NULL DEFAULT '[]'::jsonb,
    start_date DATE,
    end_date DATE,
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date)
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS farm_season_budgets_farm_idx ON farm_season_budgets (farm_id, created_at DESC)');
  await database.raw(`CREATE TABLE IF NOT EXISTS farm_budget_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES farm_season_budgets(budget_id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    entry_date DATE NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS farm_budget_entries_budget_date_idx ON farm_budget_entries (budget_id, entry_date DESC)');
  await database.raw(`CREATE TABLE IF NOT EXISTS farm_activity_logs (
    sequence BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    activity_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    farm_id UUID NOT NULL REFERENCES farms(farm_id) ON DELETE RESTRICT,
    actor_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    activity_date DATE NOT NULL,
    crop TEXT NOT NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN ('Planting', 'Spraying (Pest Control)', 'Irrigation', 'Harvest', 'Fertilizing', 'Other')),
    field_name TEXT NOT NULL DEFAULT '',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    location JSONB,
    weather JSONB,
    photo_name TEXT,
    photo_mime_type TEXT,
    photo_data TEXT,
    photo_sha256 TEXT,
    previous_hash TEXT,
    content_hash TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK ((photo_data IS NULL AND photo_name IS NULL AND photo_mime_type IS NULL AND photo_sha256 IS NULL)
      OR (photo_data IS NOT NULL AND photo_name IS NOT NULL AND photo_mime_type IS NOT NULL AND photo_sha256 IS NOT NULL))
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS farm_activity_logs_farm_sequence_idx ON farm_activity_logs (farm_id, sequence DESC)');
  await database.raw(`CREATE OR REPLACE FUNCTION reject_farm_activity_log_mutation()
    RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'Farm activity logs are append-only';
    END;
    $$ LANGUAGE plpgsql`);
  await database.raw(`DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'farm_activity_logs_append_only'
          AND tgrelid = 'farm_activity_logs'::regclass
          AND NOT tgisinternal
      ) THEN
        CREATE TRIGGER farm_activity_logs_append_only
        BEFORE UPDATE OR DELETE ON farm_activity_logs
        FOR EACH ROW EXECUTE FUNCTION reject_farm_activity_log_mutation();
      END IF;
    END;
    $$`);
  await database.raw(`CREATE TABLE IF NOT EXISTS workforce_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    skills TEXT[] NOT NULL,
    region TEXT NOT NULL,
    daily_rate NUMERIC(14, 2) NOT NULL CHECK (daily_rate > 0),
    experience TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    availability TEXT NOT NULL DEFAULT 'available' CHECK (availability IN ('available', 'seasonal', 'busy')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS workforce_profiles_region_idx ON workforce_profiles (region, availability)');
  await database.raw(`CREATE TABLE IF NOT EXISTS workforce_jobs (
    job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    skill TEXT NOT NULL,
    location TEXT NOT NULL,
    workers_needed INTEGER NOT NULL CHECK (workers_needed BETWEEN 1 AND 1000),
    daily_rate NUMERIC(14, 2) NOT NULL CHECK (daily_rate > 0),
    start_date DATE NOT NULL,
    duration_days INTEGER NOT NULL CHECK (duration_days BETWEEN 1 AND 365),
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'filled', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS workforce_jobs_status_created_idx ON workforce_jobs (status, created_at DESC)');
  await database.raw(`CREATE TABLE IF NOT EXISTS workforce_applications (
    application_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES workforce_jobs(job_id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    message TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (job_id, applicant_id)
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS workforce_applications_applicant_idx ON workforce_applications (applicant_id, created_at DESC)');
  await database.raw(`CREATE TABLE IF NOT EXISTS transport_requests (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    pickup TEXT NOT NULL,
    destination TEXT NOT NULL,
    cargo TEXT NOT NULL,
    weight_kg NUMERIC(14, 2),
    pickup_date DATE,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'cancelled', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS transport_requests_status_created_idx ON transport_requests (status, created_at DESC)');
  await database.raw(`CREATE TABLE IF NOT EXISTS transport_quotes (
    quote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES transport_requests(request_id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (request_id, provider_id)
  )`);
  await database.raw('CREATE INDEX IF NOT EXISTS transport_quotes_provider_idx ON transport_quotes (provider_id, created_at DESC)');
}

function serializeJob(row) {
  return { ...row, daily_rate: Number(row.daily_rate), applications_count: Number(row.applications_count || 0) };
}

async function listWorkforceJobs({ userId, mine = false }) {
  const query = knex('workforce_jobs as jobs')
    .join('users as employers', 'employers.user_id', 'jobs.employer_id')
    .leftJoin('workforce_applications as applications', 'applications.job_id', 'jobs.job_id')
    .groupBy('jobs.job_id', 'employers.name')
    .select(
      'jobs.job_id', 'jobs.employer_id', 'employers.name as employer_name',
      'jobs.title', 'jobs.skill', 'jobs.location', 'jobs.workers_needed',
      'jobs.daily_rate', 'jobs.start_date', 'jobs.duration_days', 'jobs.details',
      'jobs.status', 'jobs.created_at',
      knex.raw('COUNT(applications.application_id)::integer AS applications_count')
    )
    .orderBy('jobs.created_at', 'desc')
    .limit(200);
  if (mine) query.where('jobs.employer_id', userId);
  else query.where('jobs.status', 'open');
  return (await query).map(serializeJob);
}

async function createWorkforceJob({ employer, title, skill, location, workersNeeded, dailyRate, startDate, durationDays, details }) {
  requireRole(employer, ['farmer']);
  const normalizedTitle = requiredText(title, 'title', 120);
  const normalizedSkill = requiredText(skill, 'skill', 80);
  const normalizedLocation = requiredText(location, 'location', 120);
  const workers = boundedNumber(workersNeeded, 'workers_needed', { minimum: 1, maximum: 1000, integer: true });
  const rate = boundedNumber(dailyRate, 'daily_rate', { minimum: 0, maximum: 1000000000 });
  if (rate === 0) throw workflowError('invalid_daily_rate');
  const start = validDate(startDate, 'start_date');
  const duration = boundedNumber(durationDays, 'duration_days', { minimum: 1, maximum: 365, integer: true });
  const normalizedDetails = optionalText(details, 'details', 2000);
  const [job] = await knex('workforce_jobs').insert({
    employer_id: employer.user_id,
    title: normalizedTitle,
    skill: normalizedSkill,
    location: normalizedLocation,
    workers_needed: workers,
    daily_rate: rate,
    start_date: start,
    duration_days: duration,
    details: normalizedDetails,
  }).returning('*');
  return serializeJob({ ...job, applications_count: 0 });
}

async function upsertWorkforceProfile({ user, skills, region, dailyRate, experience, bio, availability }) {
  requireRole(user, ['worker']);
  if (!Array.isArray(skills) || !skills.length || skills.length > 12) throw workflowError('invalid_skills');
  const normalizedSkills = [...new Set(skills.map((skill) => requiredText(skill, 'skill', 60)))];
  if (!['available', 'seasonal', 'busy'].includes(availability)) throw workflowError('invalid_availability');
  const rate = boundedNumber(dailyRate, 'daily_rate', { minimum: 0, maximum: 1000000000 });
  if (rate === 0) throw workflowError('invalid_daily_rate');
  const profile = {
    user_id: user.user_id,
    skills: normalizedSkills,
    region: requiredText(region, 'region', 120),
    daily_rate: rate,
    experience: optionalText(experience, 'experience', 300),
    bio: optionalText(bio, 'bio', 1000),
    availability,
    updated_at: new Date(),
  };
  const [row] = await knex('workforce_profiles')
    .insert(profile)
    .onConflict('user_id')
    .merge(profile)
    .returning('*');
  return { ...row, daily_rate: Number(row.daily_rate) };
}

async function getWorkforceProfile(userId) {
  const row = await knex('workforce_profiles').where({ user_id: userId }).first();
  return row ? { ...row, daily_rate: Number(row.daily_rate) } : null;
}

async function applyToWorkforceJob({ applicant, jobId, message = '' }) {
  requireRole(applicant, ['worker']);
  const profile = await getWorkforceProfile(applicant.user_id);
  if (!profile) throw workflowError('workforce_profile_required', 409);
  if (profile.availability === 'busy') throw workflowError('worker_unavailable', 409);
  const job = await knex('workforce_jobs').where({ job_id: jobId, status: 'open' }).first();
  if (!job) throw workflowError('job_not_open', 404);
  if (job.employer_id === applicant.user_id) throw workflowError('cannot_apply_to_own_job', 403);
  try {
    const [application] = await knex('workforce_applications').insert({
      job_id: jobId,
      applicant_id: applicant.user_id,
      message: optionalText(message, 'message', 1000),
    }).returning('*');
    return application;
  } catch (error) {
    if (error.code === '23505') throw workflowError('already_applied', 409);
    throw error;
  }
}

async function listMyWorkforceApplications(userId) {
  return knex('workforce_applications as applications')
    .join('workforce_jobs as jobs', 'jobs.job_id', 'applications.job_id')
    .join('users as employers', 'employers.user_id', 'jobs.employer_id')
    .where('applications.applicant_id', userId)
    .select(
      'applications.application_id', 'applications.job_id', 'applications.message',
      'applications.status as application_status', 'applications.created_at as applied_at',
      'jobs.title', 'jobs.skill', 'jobs.location', 'jobs.daily_rate', 'jobs.start_date',
      'jobs.duration_days', 'jobs.status as job_status', 'employers.name as employer_name'
    )
    .orderBy('applications.created_at', 'desc')
    .limit(200)
    .then((rows) => rows.map((row) => ({ ...row, daily_rate: Number(row.daily_rate) })));
}

async function listJobApplications({ jobId, employerId }) {
  const job = await knex('workforce_jobs').where({ job_id: jobId, employer_id: employerId }).first();
  if (!job) throw workflowError('job_not_found', 404);
  return knex('workforce_applications as applications')
    .join('users as applicants', 'applicants.user_id', 'applications.applicant_id')
    .leftJoin('workforce_profiles as profiles', 'profiles.user_id', 'applications.applicant_id')
    .where('applications.job_id', jobId)
    .select(
      'applications.application_id', 'applications.job_id', 'applications.applicant_id',
      'applications.message', 'applications.status', 'applications.created_at',
      'applicants.name as applicant_name', 'profiles.skills', 'profiles.region',
      'profiles.daily_rate', 'profiles.experience', 'profiles.bio'
    )
    .orderBy('applications.created_at', 'asc')
    .then((rows) => rows.map((row) => ({ ...row, daily_rate: Number(row.daily_rate || 0) })));
}

async function updateWorkforceApplication({ applicationId, employerId, status }) {
  if (!['accepted', 'declined'].includes(status)) throw workflowError('invalid_application_status');
  return knex.transaction(async (transaction) => {
    const application = await transaction('workforce_applications')
      .where({ application_id: applicationId })
      .forUpdate()
      .first();
    if (!application) throw workflowError('application_not_found', 404);
    const job = await transaction('workforce_jobs')
      .where({ job_id: application.job_id, employer_id: employerId })
      .forUpdate()
      .first();
    if (!job) throw workflowError('application_not_found', 404);
    if (job.status !== 'open' && status === 'accepted') throw workflowError('job_not_open', 409);
    if (status === 'accepted' && application.status !== 'accepted') {
      const { count } = await transaction('workforce_applications')
        .where({ job_id: job.job_id, status: 'accepted' })
        .count('* as count')
        .first();
      if (Number(count) >= job.workers_needed) throw workflowError('job_filled', 409);
    }
    const [updated] = await transaction('workforce_applications')
      .where({ application_id: applicationId })
      .update({ status, updated_at: transaction.fn.now() })
      .returning('*');
    if (status === 'accepted') {
      const { count } = await transaction('workforce_applications')
        .where({ job_id: job.job_id, status: 'accepted' })
        .count('* as count')
        .first();
      if (Number(count) >= job.workers_needed) {
        await transaction('workforce_jobs').where({ job_id: job.job_id }).update({ status: 'filled', updated_at: transaction.fn.now() });
      }
    }
    return updated;
  });
}

async function createTransportRequest({ owner, pickup, destination, cargo, weightKg, pickupDate, details }) {
  requireRole(owner, ['farmer', 'buyer']);
  const row = {
    owner_id: owner.user_id,
    pickup: requiredText(pickup, 'pickup', 160),
    destination: requiredText(destination, 'destination', 160),
    cargo: requiredText(cargo, 'cargo', 120),
    weight_kg: weightKg === undefined || weightKg === null || weightKg === '' ? null : boundedNumber(weightKg, 'weight_kg', { minimum: 0.01, maximum: 1000000 }),
    pickup_date: pickupDate ? validDate(pickupDate, 'pickup_date') : null,
    details: optionalText(details, 'details', 2000),
  };
  const [request] = await knex('transport_requests').insert(row).returning('*');
  return request;
}

function serializeTransportRequest(row, quotes = []) {
  return {
    ...row,
    weight_kg: row.weight_kg === null ? null : Number(row.weight_kg),
    quotes: quotes.map((quote) => ({ ...quote, amount: Number(quote.amount) })),
  };
}

async function listOpenTransportRequests(provider) {
  requireRole(provider, ['transporter']);
  const rows = await knex('transport_requests as requests')
    .join('users as owners', 'owners.user_id', 'requests.owner_id')
    .leftJoin('transport_quotes as quotes', 'quotes.request_id', 'requests.request_id')
    .where('requests.status', 'open')
    .whereNot('requests.owner_id', provider.user_id)
    .groupBy('requests.request_id', 'owners.name')
    .select(
      'requests.request_id', 'requests.owner_id', 'owners.name as customer_name',
      'requests.pickup', 'requests.destination', 'requests.cargo', 'requests.weight_kg',
      'requests.pickup_date', 'requests.details', 'requests.status', 'requests.created_at',
      knex.raw('COUNT(quotes.quote_id)::integer AS quotes_count'),
      knex.raw('EXISTS (SELECT 1 FROM transport_quotes AS own_quotes WHERE own_quotes.request_id = requests.request_id AND own_quotes.provider_id = ?) AS has_quoted', [provider.user_id])
    )
    .orderBy('requests.created_at', 'desc')
    .limit(200);
  return rows.map((row) => ({ ...row, weight_kg: row.weight_kg === null ? null : Number(row.weight_kg) }));
}

async function listMyTransportRequests(ownerId) {
  const requests = await knex('transport_requests').where({ owner_id: ownerId }).orderBy('created_at', 'desc').limit(200);
  const quoteRows = await knex('transport_quotes as quotes')
    .join('users as providers', 'providers.user_id', 'quotes.provider_id')
    .join('transport_requests as requests', 'requests.request_id', 'quotes.request_id')
    .where('requests.owner_id', ownerId)
    .select(
      'quotes.quote_id', 'quotes.request_id', 'quotes.provider_id',
      'providers.name as provider_name', 'quotes.amount', 'quotes.details',
      'quotes.status', 'quotes.created_at'
    )
    .orderBy('quotes.created_at', 'asc');
  const quotesByRequest = new Map();
  quoteRows.forEach((quote) => {
    const current = quotesByRequest.get(quote.request_id) || [];
    current.push(quote);
    quotesByRequest.set(quote.request_id, current);
  });
  return requests.map((request) => serializeTransportRequest(request, quotesByRequest.get(request.request_id) || []));
}

async function createTransportQuote({ provider, requestId, amount, details }) {
  requireRole(provider, ['transporter']);
  const request = await knex('transport_requests').where({ request_id: requestId, status: 'open' }).first();
  if (!request) throw workflowError('transport_request_not_open', 404);
  if (request.owner_id === provider.user_id) throw workflowError('cannot_quote_own_request', 403);
  const quoteAmount = boundedNumber(amount, 'amount', { minimum: 0, maximum: 1000000000 });
  if (quoteAmount === 0) throw workflowError('invalid_amount');
  try {
    const [quote] = await knex('transport_quotes').insert({
      request_id: requestId,
      provider_id: provider.user_id,
      amount: quoteAmount,
      details: optionalText(details, 'details', 1000),
    }).returning('*');
    return { ...quote, amount: Number(quote.amount) };
  } catch (error) {
    if (error.code === '23505') throw workflowError('quote_already_submitted', 409);
    throw error;
  }
}

async function updateTransportQuote({ quoteId, ownerId, status }) {
  if (!['accepted', 'declined'].includes(status)) throw workflowError('invalid_quote_status');
  return knex.transaction(async (transaction) => {
    const quote = await transaction('transport_quotes').where({ quote_id: quoteId }).forUpdate().first();
    if (!quote) throw workflowError('quote_not_found', 404);
    const request = await transaction('transport_requests')
      .where({ request_id: quote.request_id, owner_id: ownerId })
      .forUpdate()
      .first();
    if (!request) throw workflowError('quote_not_found', 404);
    if (status === 'accepted' && request.status !== 'open') throw workflowError('transport_request_not_open', 409);
    if (status === 'accepted') {
      await transaction('transport_quotes').where({ request_id: request.request_id }).whereNot({ quote_id: quoteId }).where({ status: 'pending' }).update({ status: 'declined', updated_at: transaction.fn.now() });
      await transaction('transport_requests').where({ request_id: request.request_id }).update({ status: 'assigned', updated_at: transaction.fn.now() });
    }
    const [updated] = await transaction('transport_quotes').where({ quote_id: quoteId }).update({ status, updated_at: transaction.fn.now() }).returning('*');
    return { ...updated, amount: Number(updated.amount) };
  });
}

module.exports = {
  ensureCrossRoleWorkflowSchema,
  listWorkforceJobs,
  createWorkforceJob,
  upsertWorkforceProfile,
  getWorkforceProfile,
  applyToWorkforceJob,
  listMyWorkforceApplications,
  listJobApplications,
  updateWorkforceApplication,
  createTransportRequest,
  listOpenTransportRequests,
  listMyTransportRequests,
  createTransportQuote,
  updateTransportQuote,
};
