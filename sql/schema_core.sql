-- Core PostgreSQL + PostGIS schema (simplified)
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(32) UNIQUE NOT NULL,
  name TEXT,
  nida_number TEXT,
  role TEXT,
  trust_score NUMERIC DEFAULT 0,
  region TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Farms
CREATE TABLE IF NOT EXISTS farms (
  farm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(user_id),
  name TEXT,
  farm_boundary GEOMETRY(POLYGON,4326),
  soil_type TEXT,
  total_acres NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Fields (per-farm)
CREATE TABLE IF NOT EXISTS fields (
  field_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id UUID REFERENCES farms(farm_id),
  name TEXT,
  crop TEXT,
  planting_date DATE,
  harvest_date DATE,
  field_boundary GEOMETRY(POLYGON,4326)
);

-- Batches
CREATE TABLE IF NOT EXISTS batches (
  batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES users(user_id),
  crop_type TEXT,
  quantity NUMERIC,
  harvest_date DATE,
  quality_grade TEXT,
  current_location GEOMETRY(POINT,4326)
);

-- Batch events
CREATE TABLE IF NOT EXISTS batch_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES batches(batch_id),
  actor_id UUID,
  event_type TEXT,
  location GEOMETRY(POINT,4326),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Marketplace listings
CREATE TABLE IF NOT EXISTS listings (
  listing_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES users(user_id),
  crop_type TEXT,
  quantity NUMERIC,
  price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Jicho scan history
CREATE TABLE IF NOT EXISTS jicho_scans (
  scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id UUID REFERENCES users(user_id),
  diagnosis TEXT,
  confidence NUMERIC,
  image_base64 TEXT,
  crop TEXT,
  recommended_treatment TEXT,
  gps GEOMETRY(POINT,4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE jicho_scans ADD COLUMN IF NOT EXISTS image_base64 TEXT;
ALTER TABLE jicho_scans ADD COLUMN IF NOT EXISTS crop TEXT;
ALTER TABLE jicho_scans ADD COLUMN IF NOT EXISTS recommended_treatment TEXT;

-- Community chat
CREATE TABLE IF NOT EXISTS community_conversations (
  conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  preview TEXT,
  time_label TEXT,
  avatar_url TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES community_conversations(conversation_id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  author_avatar_url TEXT,
  body TEXT NOT NULL,
  attachment_name TEXT,
  attachment_url TEXT,
  attachment_kind TEXT,
  image_url TEXT,
  location_latitude NUMERIC,
  location_longitude NUMERIC,
  location_label TEXT,
  incoming BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_messages_conversation_idx
  ON community_messages (conversation_id, created_at);

ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS attachment_kind TEXT;
ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS location_latitude NUMERIC;
ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS location_longitude NUMERIC;
ALTER TABLE community_messages ADD COLUMN IF NOT EXISTS location_label TEXT;
