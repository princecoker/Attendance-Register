CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE
);
CREATE TABLE participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  name VARCHAR(120) NOT NULL,
  UNIQUE (school_id, name)
);
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  date DATE NOT NULL,
  week SMALLINT NOT NULL CHECK (week BETWEEN 1 AND 53),
  arrival_time TIME NOT NULL,
  departure_time TIME,
  topic TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (departure_time IS NULL OR departure_time >= arrival_time)
);
CREATE INDEX sessions_date_week_idx ON sessions(date, week);
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id),
  status VARCHAR(7) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE')),
  arrival_time TIME,
  departure_time TIME,
  UNIQUE (session_id, participant_id),
  CHECK (status <> 'ABSENT' OR (arrival_time IS NULL AND departure_time IS NULL)),
  CHECK (departure_time IS NULL OR (arrival_time IS NOT NULL AND departure_time >= arrival_time))
);
