CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS vacancies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employer_id UUID NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL,
    location    TEXT,
    salary_min  INTEGER NOT NULL DEFAULT 0,
    salary_max  INTEGER NOT NULL DEFAULT 0,
    job_type    TEXT NOT NULL DEFAULT 'Full-time',
    skills      TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vacancies_employer_id ON vacancies(employer_id);

CREATE TABLE IF NOT EXISTS employer_profiles (
    employer_id         UUID PRIMARY KEY,
    company_name        TEXT NOT NULL,
    company_description TEXT,
    industry            TEXT,
    company_size        TEXT,
    website             TEXT,
    location            TEXT,
    contact_email       TEXT,
    contact_phone       TEXT,
    bin                 VARCHAR(12) UNIQUE,
    bin_status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
