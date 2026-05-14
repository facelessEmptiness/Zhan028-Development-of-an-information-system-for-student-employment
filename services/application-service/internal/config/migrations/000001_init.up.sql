CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS applications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id   UUID NOT NULL,
    vacancy_id   UUID NOT NULL,
    employer_id  UUID NOT NULL,
    status       VARCHAR(50) NOT NULL DEFAULT 'applied',
    cover_letter TEXT,
    match_score  INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, vacancy_id)
);

CREATE INDEX IF NOT EXISTS idx_applications_student_id  ON applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_vacancy_id  ON applications(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_applications_employer_id ON applications(employer_id);

CREATE TABLE IF NOT EXISTS interviews (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    student_id     UUID NOT NULL,
    employer_id    UUID NOT NULL,
    vacancy_id     UUID NOT NULL,
    scheduled_at   TIMESTAMPTZ NOT NULL,
    location       VARCHAR(500),
    notes          TEXT,
    status         VARCHAR(50) NOT NULL DEFAULT 'scheduled',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_application_id ON interviews(application_id);
CREATE INDEX IF NOT EXISTS idx_interviews_student_id     ON interviews(student_id);
CREATE INDEX IF NOT EXISTS idx_interviews_employer_id    ON interviews(employer_id);

CREATE TABLE IF NOT EXISTS employment_records (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id     UUID NOT NULL,
    employer_id    UUID NOT NULL,
    application_id UUID NOT NULL UNIQUE,
    vacancy_id     UUID NOT NULL,
    university_id  UUID,
    company_name   VARCHAR(255),
    job_title      VARCHAR(255),
    started_at     TIMESTAMPTZ NOT NULL,
    ended_at       TIMESTAMPTZ,
    status         VARCHAR(50) NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employment_student_id    ON employment_records(student_id);
CREATE INDEX IF NOT EXISTS idx_employment_employer_id   ON employment_records(employer_id);
CREATE INDEX IF NOT EXISTS idx_employment_university_id ON employment_records(university_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    sender_id      UUID NOT NULL,
    sender_role    VARCHAR(20) NOT NULL,
    content        TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_application_id ON chat_messages(application_id);
