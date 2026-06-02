CREATE TABLE IF NOT EXISTS push_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL UNIQUE,
    token      VARCHAR(500) NOT NULL,
    platform   VARCHAR(20) NOT NULL DEFAULT 'ios',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
