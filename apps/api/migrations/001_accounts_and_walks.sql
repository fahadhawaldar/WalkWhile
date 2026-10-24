-- Accounts start anonymous (created silently on first launch) and become
-- permanent when an Apple or Google login is linked. The user id never
-- changes, so everything stored against it stays with the account.
CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_anonymous boolean NOT NULL DEFAULT true,
  email        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Login methods attached to a user. One Apple/Google account can belong to
-- only one user.
CREATE TABLE identities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider   text NOT NULL CHECK (provider IN ('apple', 'google')),
  subject    text NOT NULL,
  email      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, subject)
);
CREATE INDEX identities_user_id ON identities (user_id);

-- Long-lived sessions. Only a hash of the token is stored; each refresh
-- revokes the old token and issues a new one.
CREATE TABLE refresh_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX refresh_tokens_user_id ON refresh_tokens (user_id);

-- Walk history. The id comes from the phone, so retried syncs are idempotent.
CREATE TABLE walks (
  id                uuid PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at        timestamptz NOT NULL,
  ended_at          timestamptz NOT NULL,
  outcome           text NOT NULL CHECK (outcome IN ('completed', 'interrupted')),
  wait_type         text NOT NULL CHECK (wait_type IN ('fixed', 'flexible')),
  planned_minutes   real NOT NULL,
  duration_seconds  integer NOT NULL,
  distance_meters   integer NOT NULL,
  steps             integer NOT NULL,
  returned_on_time  boolean NOT NULL,
  origin_latitude   double precision NOT NULL,
  origin_longitude  double precision NOT NULL,
  route_coordinates jsonb NOT NULL DEFAULT '[]',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX walks_user_started ON walks (user_id, started_at DESC);
