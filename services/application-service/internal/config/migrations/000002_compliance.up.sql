-- Grant-obligation compliance tracking (Article 47).
-- A separate table because most compliance states (NotYetDue, AtRisk,
-- NonCompliant) apply to students who have no employment record yet, so the
-- state cannot live on employment_records. Purely additive: no existing table
-- or column is touched.
CREATE TABLE IF NOT EXISTS compliance_records (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id           UUID NOT NULL UNIQUE,
    university_id        UUID,
    state                VARCHAR(20) NOT NULL DEFAULT 'NotYetDue'
        CHECK (state IN ('NotYetDue', 'InProgress', 'Compliant', 'AtRisk', 'NonCompliant', 'Exempt')),
    graduation_date      TIMESTAMPTZ,                 -- NULL = not graduated yet
    grant_years          INTEGER NOT NULL DEFAULT 3
        CHECK (grant_years IN (2, 3)),               -- 2 or 3 years per sub-category
    deadline             TIMESTAMPTZ,                 -- legal deadline: AtRisk -> NonCompliant
    employment_record_id UUID,                        -- qualifying job, when InProgress/Compliant
    -- evidence / audit trail for university-staff transitions
    exempt_reason        VARCHAR(100),                -- Clause 17-2 ground, when Exempt
    evidence_doc_id      UUID,                         -- supporting document (Compliant/Exempt)
    transitioned_by      UUID,                         -- staff user who made the last evidence transition
    transitioned_at      TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_student_id    ON compliance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_compliance_university_id ON compliance_records(university_id);
CREATE INDEX IF NOT EXISTS idx_compliance_state         ON compliance_records(state);
